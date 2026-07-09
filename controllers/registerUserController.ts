import { AuthService } from "../services/authentcationServices";

export const registerUser = async (req: any, res: any) => {
  try {
    const {
      email,
      password,
      role,
      matricNumber,
      phoneNumber,
      fullName,
      staffKey,
      department,
      level,
    } = req.body;

    if (
      !email ||
      !password ||
      !role ||
      !fullName ||
      !phoneNumber ||
      !department ||
      (role === "student" && !level) ||
      (role === "student" && !matricNumber) ||
      (role === "lecturer" && !staffKey)
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (role === "student" && !matricNumber) {
      return res
        .status(400)
        .json({ error: "Matric number is required for students" });
    }
    if (role !== "student" && role !== "lecturer") {
      return res
        .status(400)
        .json({ error: "Invalid role. Must be 'student' or 'lecturer'" });
    }
    if (!/^\d{11}$/.test(phoneNumber)) {
      return res
        .status(400)
        .json({ error: "Invalid phone number. Must be 11 digits" });
    }

    if (
      role === "student" &&
      !/^\d{4}\/\d\/\d+[a-zA-Z]{2}$/.test(matricNumber)
    ) {
      return res.status(400).json({
        error: "your matric number must be in the format XXXX/X/XXXX",
      });
    }
    if (
      role === "student" &&
      !/^[a-z]+\.[a-z]\d{7}@st\.futminna\.edu\.ng$/i.test(email)
    ) {
      return res.status(400).json({
        error:
          "Invalid email format for students. Must be in the format firstname.studentID@st.futminna.edu.ng",
      });
    }
    if (
      role === "lecturer" &&
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
    ) {
      return res.status(400).json({ error: "the email format is not correct" });
    }

    if (role === "lecturer") {
      if (!staffKey) {
        return res
          .status(400)
          .json({ error: "staff-Key is required for lecturers" });
      }
      if (staffKey !== process.env.LECTURER_REGISTRATION_KEY) {
        return res
          .status(400)
          .json({ error: "Invalid registration key for lecturers" });
      }
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters long" });
    }
    if (fullName.trim().split(" ").length < 2) {
      return res
        .status(400)
        .json({ error: "Full name must contain at least two words" });
    }
    if (password.toLowerCase().includes("password")) {
      return res
        .status(400)
        .json({ error: "Password should not contain the word 'password'" });
    }
    if (password.toLowerCase().includes(email.split("@")[0].toLowerCase())) {
      return res
        .status(400)
        .json({ error: "Password should not contain parts of the email" });
    }

    const response = await AuthService.registerUser({
      email,
      password,
      role,
      matricNumber,
      phoneNumber,
      fullName,
      department,
      level,
    });
    console.log("Registration Response:", response);
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
