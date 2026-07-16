import { Database, AdminDatabase } from "../config/database/connectdatabase";
import { mqttClient } from "../config/MQTT/mqtt";

export const SessionService = {
  startSession: async (courseId: string): Promise<any> => {
    const { data: session, error } = await Database.from("class_sessions")
      .insert([{ course_id: courseId, status: "active" }])
      .select("id, course_id, courses(course_code)")
      .single();

    if (error) {
      // Unique Constraint Violation
      if (error.code === "23505") {
        throw new Error("ALREADY_ACTIVE");
      }
      throw error;
    }

    const courseData: any = session.courses;
    const extractedCourseCode = Array.isArray(courseData)
      ? courseData[0].course_code
      : courseData.course_code;

    //activate ESP32 to start class session by sending the course code`
    const payload = JSON.stringify({
      command: "StartSession",
      course: extractedCourseCode,
      courseId: courseId,
    });
    mqttClient.publish("start_class", payload);

    return session;
  },

  getActiveSession: async (courseId: string): Promise<any> => {
    const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
    const { data: session, error } = await AdminDatabase.from("class_sessions")
      .select("id, course_id, courses!course_id(course_code)")
      .eq("course_id", courseId)
      .eq("session_date", today) // Filter by today's date
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return session;
  },

  endSession: async (sessionId: string, course_code: string): Promise<any> => {
    const { data: session, error } = await Database.from("class_sessions")
      .update({ status: "closed", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const payload = JSON.stringify({
      command: "endSession",
      course: course_code,
    });
    mqttClient.publish("end_class", payload);

    try {
      //Fetch enrolled students from 'student_courses'
      const { data: enrolledStudents } = await Database.from("student_courses")
        .select("student_id")
        .eq("course_id", session.course_id);

      // Fetch successfully scanned students
      const { data: presentLogs } = await Database.from("attendance_logs")
        .select("student_id")
        .eq("course_id", session.course_id)
        .gte("created_at", session.created_at)
        .lte("created_at", session.ended_at);

      if (enrolledStudents && presentLogs) {
        const presentIds = presentLogs.map((log) => log.student_id);

        //  Filter to find the missing students
        const absentRecords = enrolledStudents
          .filter((enrolled) => !presentIds.includes(enrolled.student_id))
          .map((missingStudent) => ({
            student_id: missingStudent.student_id,
            course_id: session.course_id,
            status: "absent",
          }));

        //  Bulk insert missing students
        if (absentRecords.length > 0) {
          await Database.from("attendance_logs").insert(absentRecords);
        }
      }
    } catch (ghostDataError) {
      console.error("Failed to generate absent records:", ghostDataError);
    }

    return session;
  },
};
