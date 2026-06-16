import { Database } from "../config/database/connectdatabase";
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

    // tell the ESP32 to start class session by sending the course code`
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
    const { data: session, error } = await Database.from("class_sessions")
      .select("id, course_id, courses(course_code)")
      .eq("course_id", courseId)
      .eq("session_date", today) // Filter by today's date
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return session;
  },

  endSession: async (sessionId: string): Promise<any> => {
    const { data: session, error } = await Database.from("class_sessions")
      .update({ status: "closed", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Hardware Logic: Tell the ESP32 to go to get back to idle state by sending the end session command
    const payload = JSON.stringify({ command: "endSession" });
    mqttClient.publish("end_class", payload);

    return session;
  },
};
