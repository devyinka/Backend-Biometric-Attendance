import {
  Database,
  DatabasewithHardware,
} from "../config/database/connectdatabase";
import { BlockchainGateway } from "../gateWay/blockChainGateWay";
import { faceService } from "./faceService";

export const Attendance = {
  markLiveAttendance: async (
    face: Buffer,
    fingerprintSlot: number,
    courseId: string,
  ) => {
    // using fingerprint to lookup student
    const { data: student } = await DatabasewithHardware.from("biometrics")
      .select("student_id, face_vector, user_profiles(full_name)")
      .eq("fingerprint_slot", fingerprintSlot)
      .single();
    if (!student) throw new Error("UNREGISTERED_FINGERPRINT");

    //face verification with the face store
    const liveFaceArray = await faceService.facedetection(face);
    const isMatch = await faceService.verifyFace(
      student.face_vector,
      liveFaceArray,
    );

    if (!isMatch) {
      throw new Error("FACE_MISMATCH_REJECTED");
    }
    // Verify the Class is actually active for this specific course
    const { data: session } = await Database.from("class_sessions")
      .select("id")
      .eq("course_id", courseId)
      .eq("status", "active")
      .single();
    if (!session) throw new Error("NO_ACTIVE_SESSION");

    // Get the Blockchain Receipt (Hyperledger)
    const txHash = await BlockchainGateway.recordAttendance(
      student.student_id,
      session.id,
    );
    // Save the Attendance + Blockchain_receipt to Database
    await Database.from("attendance_logs").insert({
      student_id: student.student_id,
      session_id: session.id,
      method: "face_and_fingerprint",
      tx_hash: txHash,
    });

    const profileData: any = student.user_profiles;
    const studentName = Array.isArray(profileData)
      ? profileData[0].full_name
      : profileData.full_name;
    return {
      status: "success",
      message: `Attendance marked for ${studentName}`,
      txHash: txHash,
    };
  },

  // This function is designed to handle offline attendance marking from the ESP32 device.
  markOfflineAttendance: async (
    scans: { slot: number; timestamp: string }[],
    courseId: string,
  ) => {
    // Get ALL sessions for this course (so I can check timestamps)
    // I select started_at and ended_at to create  "Time Windows" for offline attendance for someone not to mark attendance when class is not actually holding
    const { data: sessions, error: sessionError } = await Database.from(
      "class_sessions",
    )
      .select("id, started_at, ended_at")
      .eq("course_id", courseId);

    if (sessionError || !sessions || sessions.length === 0) {
      throw new Error("NO_SESSIONS_FOUND_FOR_COURSE");
    }

    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    // Loop through every offline scan the ESP32 sent
    for (const scan of scans) {
      try {
        const scanTime = new Date(scan.timestamp).getTime();

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
        const { data: student } = await Database.from("biometrics")
          .select("student_id")
          .eq("fingerprint_slot", scan.slot)
          .single();

        if (!student) {
          failedCount++; // Fingerprint not registered
          continue;
        }

        //SECURITY: Prevent Double-Marking
        // If the ESP32 glitches and sends the same array twice, do not hit the blockchain again.
        const { data: existingLog } = await Database.from("attendance_logs")
          .select("id")
          .eq("student_id", student.student_id)
          .eq("session_id", targetSession.id)
          .maybeSingle();

        if (existingLog) {
          duplicateCount++; // Already marked, safely ignore.
          continue;
        }

        //  Get the Blockchain Receipt (Hyperledger)
        const txHash = await BlockchainGateway.recordAttendance(
          student.student_id,
          targetSession.id,
        );

        // Save to Database
        await Database.from("attendance_logs").insert({
          student_id: student.student_id,
          session_id: targetSession.id,
          method: "fingerprint_offline",
          tx_hash: txHash,
        });

        successCount++;
      } catch (err) {
        console.error(
          `Error processing offline scan for slot ${scan.slot}:`,
          err,
        );
        failedCount++;
      }
    }

    //  Return a detailed summary report back to the ESP32
    return {
      status: "success",
      message: "Offline batch processing complete",
      stats: {
        totalReceived: scans.length,
        successful: successCount,
        duplicatesIgnored: duplicateCount,
        failed: failedCount,
      },
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
    const { data: profile, error: profileError } = await Database.from(
      "user_profiles",
    )
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      throw new Error("UNAUTHORIZED_USER");
    }

    const userRole = profile.role;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Everyone gets these base columns
    let selectQuery = `
      id,
      created_at,
      status,
      tx_hash,
      student_id
    `;

    // Only attach the heavy profile join if a lecturer is requesting it
    if (userRole === "lecturer") {
      selectQuery += `, user_profiles ( full_name, matric_number, profile_image )`;
    }

    // BASE QUERY
    let query = Database.from("attendance_logs")
      .select(selectQuery, { count: "exact" })
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .range(from, to);

    //  SECURITY FILTER
    if (userRole === "student") {
      query = query.eq("student_id", userId);
    }

    //  DATE FILTER
    if (month !== "all") {
      const parsedMonth = typeof month === "string" ? parseInt(month) : month;
      const startDate = new Date(year, parsedMonth - 1, 1).toISOString();
      const endDate = new Date(
        year,
        parsedMonth,
        0,
        23,
        59,
        59,
        999,
      ).toISOString();

      query = query.gte("created_at", startDate).lte("created_at", endDate);
    }

    // EXECUTE
    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return {
      records: data,
      pagination: {
        totalItems: count || 0,
        currentPage: page,
        itemsPerPage: limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  },

  getsemesterReport: async (courseId: string) => {
    const { data, error } = await Database.rpc("get_semester_attendance", {
      p_course_id: courseId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },
};
