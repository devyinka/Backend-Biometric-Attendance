import { Database, AdminDatabase } from "../config/database/connectdatabase";
import { mqttClient } from "../config/MQTT/mqtt";

export const SessionService = {
  startSession: async (
    courseId: string,
    date: string,
    startTime: string,
    endTime: string,
    venue: string,
  ): Promise<any> => {
    if (!mqttClient.connected) {
      throw new Error("Kiosk is currently offline. Please check connection.");
    }

    const startDateTime = new Date(`${date}T${startTime}:00Z`);
    const endDateTime = new Date(`${date}T${endTime}:00Z`);

    const { data: session, error } = await Database.from("class_sessions")
      .insert([
        {
          course_id: courseId,
          status: "active",
          session_date: date,
          started_at: startDateTime,
          ended_at: endDateTime,
          venue: venue,
        },
      ])
      .select("id, course_id, courses(course_code)")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("An active session already exists for this course.");
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

    // Publish start_class with retain
    await new Promise((resolve, reject) => {
      mqttClient.publish(
        "start_class",
        payload,
        { qos: 1, retain: true },
        (err) => {
          if (err) {
            console.error("Failed to start class on MQTT:", err);
            reject(new Error("Failed to trigger hardware kiosk"));
          } else {
            console.log(
              `Class session started on MQTT for ${extractedCourseCode}`,
            );
            resolve(true);
          }
        },
      );
    });

    // --- CLEANUP: Clear any stale 'end_class' retained message ---
    mqttClient.publish("end_class", "", { retain: true }, (err) => {
      if (err) console.error("Failed to clear end_class retain:", err);
    });

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
    if (!mqttClient.connected) {
      throw new Error("Kiosk is currently offline. Please check connection.");
    }

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

    // Publish end_class with retain
    await new Promise((resolve, reject) => {
      mqttClient.publish(
        "end_class",
        payload,
        { qos: 1, retain: true },
        (err) => {
          if (err) {
            console.error("Failed to end class on MQTT:", err);
            reject(new Error("Failed to stop hardware kiosk"));
          } else {
            console.log(
              `Class session ended on MQTT for ${extractedCourseCode}`,
            );
            resolve(true);
          }
        },
      );
    });

    // --- CLEANUP: Clear any stale 'start_class' retained message ---
    mqttClient.publish("start_class", "", { retain: true }, (err) => {
      if (err) console.error("Failed to clear start_class retain:", err);
    });

    // Mark absent students
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
