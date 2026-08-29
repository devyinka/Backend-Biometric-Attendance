import { console } from "inspector/promises";
import { Database, AdminDatabase } from "../config/database/connectdatabase";
import { SolanaBlockchainGateway } from "../gateWay/solanaBlockchainGateway";
import { faceService } from "./faceService";

export const Attendance = {
  markLiveAttendance: async (
    face: Buffer | undefined,
    fingerprintSlot: number,
    courseId: string,
  ) => {
    console.log("Marking live attendance for course:", courseId);
    console.log("Fingerprint slot:", fingerprintSlot);
    console.log("Face provided:", !!face);

    //  Verify fingerprint exists
    const { data: student } = await AdminDatabase.from("biometrics")
      .select("student_id, face_vector, user_profiles(full_name)")
      .eq("fingerprint_slot", fingerprintSlot)
      .single();

    if (!student) throw new Error("UNREGISTERED_FINGERPRINT");

    //  Check for active session
    const { data: session } = await Database.from("class_sessions")
      .select("id")
      .eq("course_id", courseId)
      .eq("status", "active")
      .single();

    if (!session) throw new Error("NO_ACTIVE_SESSION");

    let method = "fingerprint_only";
    let faceMatched = false;

    if (face && face.length > 0) {
      try {
        const liveFaceArray = await faceService.facedetection(face);
        const isMatch = await faceService.verifyFace(
          student.face_vector,
          liveFaceArray,
        );
        if (isMatch) {
          faceMatched = true;
          method = "face_and_fingerprint";
          console.log("Face verification successful.");
        } else {
          console.warn("Face mismatch – falling back to fingerprint-only.");
          method = "fingerprint_only_fallback";
        }
      } catch (faceError) {
        console.warn(
          "Face detection/verification error, falling back to fingerprint-only:",
          faceError,
        );
        method = "fingerprint_only_fallback";
      }
    } else {
      console.log("No face provided – fingerprint-only attendance.");
    }

    //  Record attendance on Solana and Supabase
    const txHash = await SolanaBlockchainGateway.recordAttendanceHash(
      student.student_id,
      session.id,
      method,
    );

    await Database.from("attendance_logs").insert({
      student_id: student.student_id,
      session_id: session.id,
      method: method,
      tx_hash: txHash,
    });

    const profileData: any = student.user_profiles;
    const studentName = Array.isArray(profileData)
      ? profileData[0].full_name
      : profileData.full_name;

    return {
      status: "success",
      message: `Attendance marked for ${studentName} (${method})`,
      txHash,
      blockchainVerification: "Hash recorded on Solana",
    };
  },

  markOfflineAttendance: async (
    scans: { slot: number; timeStamp: string }[],
    courseId: string,
  ) => {
    console.log("Processing offline attendance scans for course:", courseId);
    console.log("Total scans received:", scans.length);
    console.log("Scan details:", scans);

    const { data: sessions, error: sessionError } = await AdminDatabase.from(
      "class_sessions",
    )
      .select("id, started_at, ended_at")
      .eq("course_id", courseId)
      .in("status", ["active", "closed"]);

    if (sessionError || !sessions || sessions.length === 0) {
      throw new Error(
        sessionError?.message || "NO_ACTIVE_OR_CLOSED_SESSIONS_FOUND",
      );
    }
    console.log(courseId, sessions);
    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    let blockchainErrors = 0;

    for (const scan of scans) {
      try {
        const scanTime = new Date(scan.timeStamp).getTime();

        const targetSession = sessions.find((s) => {
          const start = new Date(s.started_at).getTime();
          const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
          return scanTime >= start && scanTime <= end;
        });

        if (!targetSession) {
          failedCount++;
          continue;
        }

        const { data: student, error: studentError } = await AdminDatabase.from(
          "biometrics",
        )
          .select("student_id")
          .eq("fingerprint_slot", scan.slot)
          .maybeSingle();

        if (studentError || !student) {
          console.warn(
            `Student not found for slot ${scan.slot}:`,
            studentError,
          );
          failedCount++;
          continue;
        }

        const { data: existingLog } = await Database.from("attendance_logs")
          .select("id")
          .eq("student_id", student.student_id)
          .eq("session_id", targetSession.id)
          .maybeSingle();

        if (existingLog) {
          duplicateCount++;
          continue;
        }

        try {
          const txHash = await SolanaBlockchainGateway.recordAttendanceHash(
            student.student_id,
            targetSession.id,
            "fingerprint_offline",
          );

          await Database.from("attendance_logs").insert({
            student_id: student.student_id,
            session_id: targetSession.id,
            method: "fingerprint_offline",
            tx_hash: txHash,
          });

          successCount++;
        } catch (blockchainError) {
          console.error(
            `Blockchain error for student ${student.student_id}:`,
            blockchainError,
          );
          blockchainErrors++;

          await Database.from("attendance_logs").insert({
            student_id: student.student_id,
            session_id: targetSession.id,
            method: "fingerprint_offline",
            tx_hash: null,
          });

          successCount++;
        }
      } catch (err) {
        console.error(
          `Error processing offline scan for slot ${scan.slot}:`,
          err,
        );
        failedCount++;
      }
    }

    return {
      status: "success",
      message: "Offline batch processing complete",
      stats: {
        totalReceived: scans.length,
        successful: successCount,
        duplicatesIgnored: duplicateCount,
        failed: failedCount,
        blockchainSyncErrors: blockchainErrors,
      },
      note:
        blockchainErrors > 0
          ? "Some records were saved locally. Blockchain sync is pending."
          : "All records were recorded on Solana.",
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

    let selectQuery = `
        id,
        created_at,
        status,
        tx_hash,
        student_id,
        session_id
      `;

    if (userRole === "lecturer") {
      selectQuery += `, user_profiles ( full_name, matric_number, profile_image )`;
    }

    let query = Database.from("attendance_logs")
      .select(selectQuery, { count: "exact" })
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (userRole === "student") {
      query = query.eq("student_id", userId);
    }

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

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const enhancedRecords = await Promise.all(
      data.map(async (record: any) => {
        if (!record.tx_hash) {
          return {
            ...record,
            blockchainVerified: false,
            blockchainTx: null,
          };
        }

        const isVerified = await SolanaBlockchainGateway.verifyAttendanceHash(
          record.student_id,
          record.session_id,
        );

        return {
          ...record,
          blockchainVerified: isVerified,
          blockchainTx: record.tx_hash,
        };
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

  getAttendanceBlockchainRecord: async (
    studentId: string,
    sessionId: string,
  ) => {
    const record = await SolanaBlockchainGateway.getAttendanceRecord(
      studentId,
      sessionId,
    );
    if (!record) {
      throw new Error("ATTENDANCE_RECORD_NOT_FOUND_ON_CHAIN");
    }
    return record;
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
