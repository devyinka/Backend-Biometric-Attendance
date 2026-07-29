import { Database, AdminDatabase } from "../config/database/connectdatabase";
import { mqttClient } from "../config/MQTT/mqtt";

export const SessionService = {
  startSession: async (courseId: string): Promise<any> => {
    const { data: session, error } = await Database.from("class_sessions")
      .insert([{ course_id: courseId, status: "active" }])
      .select("id, course_id, courses(course_code)")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("ALREADY_ACTIVE");
      }
      throw error;
    }

    const courseData: any = session.courses;
    const extractedCourseCode = Array.isArray(courseData)
      ? courseData[0].course_code
      : courseData.course_code;

    const payload = JSON.stringify({
      command: "StartSession",
      course: extractedCourseCode,
      courseId: courseId,
    });
    mqttClient.publish("start_class", payload);

    return session;
  },

  getActiveSession: async (courseId: string): Promise<any> => {
    const today = new Date().toISOString().split("T")[0];
    const { data: session, error } = await AdminDatabase.from("class_sessions")
      .select("id, course_id, courses!course_id(course_code)")
      .eq("course_id", courseId)
      .eq("session_date", today)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return session;
  },

  endSession: async (sessionId: string): Promise<any> => {
    const { data: session, error } = await AdminDatabase.from("class_sessions")
      .update({ status: "closed", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .select("*, courses(course_code)")
      .single();

    if (error) {
      throw error;
    }

    const courseData: any = session.courses;
    const extractedCourseCode = courseData
      ? Array.isArray(courseData)
        ? courseData[0]?.course_code
        : courseData.course_code
      : "";

    const payload = JSON.stringify({
      command: "endSession",
      course: extractedCourseCode,
    });
    mqttClient.publish("end_class", payload);

    try {
      const { data: enrolledStudents } = await AdminDatabase.from(
        "student_courses",
      )
        .select("student_id")
        .eq("course_id", session.course_id);

      const { data: presentLogs } = await AdminDatabase.from("attendance_logs")
        .select("student_id")
        .eq("session_id", session.id)
        .eq("status", "present");

      if (enrolledStudents && presentLogs) {
        const presentIds = presentLogs.map((log) => log.student_id);

        const absentRecords = enrolledStudents
          .filter((enrolled) => !presentIds.includes(enrolled.student_id))
          .map((missingStudent) => ({
            student_id: missingStudent.student_id,
            session_id: session.id,
            status: "absent",
          }));

        if (absentRecords.length > 0) {
          await AdminDatabase.from("attendance_logs").insert(absentRecords);
        }
      }
    } catch (ghostDataError) {
      console.error("Failed to generate absent records:", ghostDataError);
    }

    return session;
  },
};
