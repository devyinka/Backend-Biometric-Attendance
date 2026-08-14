import { Database, AdminDatabase } from '../config/database/connectdatabase';
import { SolanaBlockchainGateway } from '../gateWay/solanaBlockchainGateway';
import { faceService } from './faceService';

export const Attendance = {
  markLiveAttendance: async (face: Buffer, fingerprintSlot: number, courseId: string) => {
    // using fingerprint to lookup student
    const { data: student } = await AdminDatabase.from('biometrics')
      .select('student_id, face_vector, user_profiles(full_name)')
      .eq('fingerprint_slot', fingerprintSlot)
      .single();
    if (!student) throw new Error('UNREGISTERED_FINGERPRINT');

    //face verification with the face store
    const liveFaceArray = await faceService.facedetection(face);
    const isMatch = await faceService.verifyFace(student.face_vector, liveFaceArray);

    if (!isMatch) {
      throw new Error('FACE_MISMATCH_REJECTED');
    }
    // Verify the Class is actually active for this specific course
    const { data: session } = await Database.from('class_sessions')
      .select('id')
      .eq('course_id', courseId)
      .eq('status', 'active')
      .single();
    if (!session) throw new Error('NO_ACTIVE_SESSION');

    // 🔗 Record attendance hash on Solana blockchain for verification
    // This stores only the hash, not the actual attendance data
    const txHash = await SolanaBlockchainGateway.recordAttendanceHash(
      student.student_id,
      session.id,
      'face_and_fingerprint', // device identifier
    );

    // Save the Attendance + Blockchain transaction signature to Database
    await Database.from('attendance_logs').insert({
      student_id: student.student_id,
      session_id: session.id,
      method: 'face_and_fingerprint',
      tx_hash: txHash, // Solana transaction signature
    });

    const profileData: any = student.user_profiles;
    const studentName = Array.isArray(profileData)
      ? profileData[0].full_name
      : profileData.full_name;
    return {
      status: 'success',
      message: `Attendance marked for ${studentName}`,
      txHash: txHash,
      blockchainVerification: 'Hash recorded on Solana',
    };
  },

  // This function is designed to handle offline attendance marking from the ESP32 device.
  markOfflineAttendance: async (scans: { slot: number; timeStamp: string }[], courseId: string) => {
    // Get ALL sessions for this course (so I can check timestamps)
    // I select started_at and ended_at to create  "Time Windows" for offline attendance for someone not to mark attendance when class is not actually holding
    const { data: sessions, error: sessionError } = await Database.from('class_sessions')
      .select('id, started_at, ended_at')
      .eq('course_id', courseId);

    if (sessionError || !sessions || sessions.length === 0) {
      throw new Error('NO_SESSIONS_FOUND_FOR_COURSE');
    }

    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    let blockchainErrors = 0;

    // Loop through every offline scan the ESP32 sent
    for (const scan of scans) {
      try {
        const scanTime = new Date(scan.timeStamp).getTime();

        //  Find which session this scan belongs to based on the timestamp
        const targetSession = sessions.find((s) => {
          const start = new Date(s.started_at).getTime();
          // If ended_at is null (class didn't close properly), use current time as fallback
          const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
          return scanTime >= start && scanTime <= end;
        });

        if (!targetSession) {
          failedCount++; // Timestamp didn't match any class time
          continue;
        }

        //  Look up the Student ID using their Fingerprint Slot
        const { data: student } = await Database.from('biometrics')
          .select('student_id')
          .eq('fingerprint_slot', scan.slot)
          .single();

        if (!student) {
          failedCount++; // Fingerprint not registered
          continue;
        }

        //SECURITY: Prevent Double-Marking
        // If the ESP32 glitches and sends the same array twice, do not hit the blockchain again.
        const { data: existingLog } = await Database.from('attendance_logs')
          .select('id')
          .eq('student_id', student.student_id)
          .eq('session_id', targetSession.id)
          .maybeSingle();

        if (existingLog) {
          duplicateCount++; // Already marked, safely ignore.
          continue;
        }

        try {
          // 🔗 Record attendance hash on Solana for verification
          const txHash = await SolanaBlockchainGateway.recordAttendanceHash(
            student.student_id,
            targetSession.id,
            'fingerprint_offline', // device identifier
          );

          // Save to Database
          await Database.from('attendance_logs').insert({
            student_id: student.student_id,
            session_id: targetSession.id,
            method: 'fingerprint_offline',
            tx_hash: txHash,
          });

          successCount++;
        } catch (blockchainError) {
          // Blockchain error - log it but don't fail the entire batch
          console.error(`Blockchain error for student ${student.student_id}:`, blockchainError);
          blockchainErrors++;

          // Still save to database (attendance is recorded locally)
          // Mark with a null tx_hash or error status for later verification
          await Database.from('attendance_logs').insert({
            student_id: student.student_id,
            session_id: targetSession.id,
            method: 'fingerprint_offline',
            tx_hash: null, // Will need to be synced later
            status: 'pending_blockchain', // Custom status field if available
          });

          successCount++; // Still count as locally successful
        }
      } catch (err) {
        console.error(`Error processing offline scan for slot ${scan.slot}:`, err);
        failedCount++;
      }
    }

    //  Return a detailed summary report back to the ESP32
    return {
      status: 'success',
      message: 'Offline batch processing complete',
      stats: {
        totalReceived: scans.length,
        successful: successCount,
        duplicatesIgnored: duplicateCount,
        failed: failedCount,
        blockchainSyncErrors: blockchainErrors,
      },
      note:
        blockchainErrors > 0
          ? 'Some records recorded locally. Blockchain sync pending.'
          : 'All records verified on Solana',
    };
  },

  getAttendanceHistory: async (
    courseId: string,
    month: string | number,
    year: number,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ) => {
    const { data: profile, error: profileError } = await Database.from('user_profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('UNAUTHORIZED_USER');
    }

    const userRole = profile.role;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Everyone gets these base columnsa
    let selectQuery = `
      id,
      created_at,
      status,
      tx_hash,
      student_id
    `;

    // Only attach the heavy profile join if a lecturer is requesting it
    if (userRole === 'lecturer') {
      selectQuery += `, user_profiles ( full_name, matric_number, profile_image )`;
    }

    // BASE QUERY
    let query = Database.from('attendance_logs')
      .select(selectQuery, { count: 'exact' })
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .range(from, to);

    //  SECURITY FILTER
    if (userRole === 'student') {
      query = query.eq('student_id', userId);
    }

    //  DATE FILTER
    if (month !== 'all') {
      const parsedMonth = typeof month === 'string' ? parseInt(month) : month;
      const startDate = new Date(year, parsedMonth - 1, 1).toISOString();
      const endDate = new Date(year, parsedMonth, 0, 23, 59, 59, 999).toISOString();

      query = query.gte('created_at', startDate).lte('created_at', endDate);
    }

    // EXECUTE
    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // 🔐 OPTIONAL: Add blockchain verification status to each record
    // This adds an extra layer of security verification
    const enhancedRecords = await Promise.all(
      data.map(async (record: any) => {
        try {
          // Verify the hash hasn't been tampered with on blockchain
          const isVerified = await SolanaBlockchainGateway.verifyAttendanceHash(
            record.student_id,
            record.session_id,
          );

          return {
            ...record,
            blockchainVerified: isVerified,
            blockchainTx: record.tx_hash,
          };
        } catch (err) {
          console.warn(`Could not verify record ${record.id} on blockchain:`, err);
          return {
            ...record,
            blockchainVerified: false,
            blockchainTx: record.tx_hash,
            verificationError: true,
          };
        }
      }),
    );

    return {
      records: enhancedRecords,
      pagination: {
        totalItems: count || 0,
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  },

  getsemesterReport: async (courseId: string) => {
    const { data, error } = await Database.rpc('get_semester_attendance', {
      p_course_id: courseId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  /**
   * ✨ NEW: Sync pending blockchain records
   * If blockchain recording fails, this function retries syncing those records
   */
  syncPendingBlockchainRecords: async () => {
    try {
      // Get all records that have null tx_hash or pending status
      const { data: pendingRecords, error } = await Database.from('attendance_logs')
        .select('*')
        .or('tx_hash.is.null,status.eq.pending_blockchain');

      if (error) throw error;
      if (!pendingRecords || pendingRecords.length === 0) {
        return { synced: 0, failed: 0 };
      }

      let synced = 0;
      let failed = 0;

      for (const record of pendingRecords) {
        try {
          const txHash = await SolanaBlockchainGateway.recordAttendanceHash(
            record.student_id,
            record.session_id,
            record.method,
          );

          // Update record with blockchain tx_hash
          await Database.from('attendance_logs')
            .update({ tx_hash: txHash, status: 'verified' })
            .eq('id', record.id);

          synced++;
        } catch (err) {
          console.error(`Failed to sync record ${record.id}:`, err);
          failed++;
        }
      }

      return {
        synced,
        failed,
        message: `Synced ${synced} records, ${failed} failed`,
      };
    } catch (err) {
      console.error('Error during blockchain sync:', err);
      return { synced: 0, failed: 0, error: true };
    }
  },
};
