import { Database } from "../config/database/connectdatabase";
import { User, Response } from "./type";
import { withRetry } from "../utilities/withRetry";

export const AuthService = {
  registerUser: async ({
    email,
    password,
    role,
    matricNumber,
    phoneNumber,
    fullName,
    department,
    level,
  }: User): Promise<Response> => {
    //check matric number either it has existed
    if (role === "student") {
      const { data: existingMatricNumber, error: matricError } =
        await Database.from("user_profiles")
          .select("matric_number")
          .eq("matric_number", matricNumber)
          .maybeSingle();
      if (matricError) {
        throw new Error(matricError.message);
      }
      if (existingMatricNumber) {
        throw new Error("Matric number already exists");
      }
    }

    //check email either it has exist
    const { data: existingEmail, error: emailError } = await Database.from(
      "user_profiles",
    )
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (emailError) {
      throw new Error(emailError.message);
    }
    if (existingEmail) {
      throw new Error("Email already exists");
    }

    const { data, error } = await withRetry(() =>
      Database.auth.signUp({
        email,
        password,
        options: {
          data: {
            email: email,
            role: role,
            matric_number: matricNumber,
            phone_number: phoneNumber,
            full_name: fullName,
            department: department,
            level: level,
          },
        },
      }),
    );
    if (error) {
      throw new Error(error.message);
    }
    return {
      id: data.user?.id || "",
      email: data.user?.email || "",
      role: data.user?.user_metadata.role || "",
      matricNumber: data.user?.user_metadata.matric_number || "",
      phoneNumber: data.user?.user_metadata.phone_number || "",
      fullName: data.user?.user_metadata.full_name || "",
      imageprofile: data.user?.user_metadata.profile_image,
      level: data.user?.user_metadata.level || "",
      department: data.user?.user_metadata.department || "",
      token: data.session?.access_token || "",
    };
  },

  loginUser: async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<Response> => {
    const { data, error } = await Database.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message);
    }
    return {
      id: data.user?.id || "",
      email: data.user?.email || "",
      role: data.user?.user_metadata.role || "",
      matricNumber: data.user?.user_metadata.matric_number || "",
      phoneNumber: data.user?.user_metadata.phone_number || "",
      fullName: data.user?.user_metadata.full_name || "",
      level: data.user?.user_metadata.level || "",
      department: data.user?.user_metadata.department || "",
      imageprofile: data?.user?.user_metadata.profile_image || "",
      token: data.session?.access_token || "",
    };
  },

  sendEmailForPasswordUpdate: async (email: string): Promise<void> => {
    const { error } = await Database.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    });
    if (error) {
      throw new Error(error.message);
    }
  },
  updatePassword: async (newPassword: string): Promise<void> => {
    const { error } = await Database.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      throw new Error(error.message);
    }
  },
};
