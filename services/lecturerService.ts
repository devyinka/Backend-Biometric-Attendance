import { Database } from "../config/database/connectdatabase"; // Adjust this import path to point to your Supabase setup

export class LecturerService {
  static async getLecturerDashboard(lecturerId: string): Promise<any> {
    const { data, error } = await Database.rpc("get_lecturer_dashboard", {
      p_lecturer_id: lecturerId,
    });

    if (error) {
      throw new Error(`Database Error: ${error.message}`);
    }

    return data;
  }
}
