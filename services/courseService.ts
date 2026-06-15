import { Database } from "../config/database/connectdatabase";
import { Readable } from "stream";
import csv from "csv-parser";
import { Course } from "./type";

export const CourseService = {
  uploadcourse: (fileStream: Readable): Promise<any> => {
    return new Promise((resolve, reject) => {
      const courseToUpload: Course[] = [];
      const errors: any[] = [];

      fileStream
        .pipe(csv())
        .on("data", (row) => {
          try {
            const rawCode = row["Course Code"] || row["course_code"];
            const cleanCode = rawCode.replace(/\s+/g, "").toUpperCase();

            const rawcourseTitle = row["Title"] || row["title"];
            const cleanCourseTitle = rawcourseTitle.trim();

            const courseLevel = parseInt(row["Level"] || row["level"], 10);

            if (!cleanCode || !cleanCourseTitle || isNaN(courseLevel)) {
              throw new Error(
                `Invalid data format in row: ${JSON.stringify(row)}`,
              );
            }

            courseToUpload.push({
              course_code: cleanCode,
              title: cleanCourseTitle,
              level: courseLevel,
            });
          } catch (error) {
            errors.push({ row, error: (error as Error).message });
          }
        })
        .on("end", async () => {
          // Reject the promise if the file was empty or invalid
          if (courseToUpload.length === 0) {
            return reject(new Error("No valid course data found in the CSV."));
          }

          // Await the database upload
          const { data, error } = await Database.from("courses")
            .upsert(courseToUpload, { onConflict: "course_code" })
            .select();

          // Reject if the database fails
          if (error) {
            return reject(error);
          }
          resolve({ success: true, data, warnings: errors });
        })
        .on("error", (streamError) => {
          // Catch any file reading errors
          reject(streamError);
        });
    });
  },
};
