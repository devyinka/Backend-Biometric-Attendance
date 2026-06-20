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
  }: User): Promise<Response> => {
    const { data, error } = await withRetry(() =>
      Database.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: role,
            matric_number: matricNumber,
            phone_number: phoneNumber,
            full_name: fullName,
          },
        },
      }),
    );
    if (error) {
      throw new Error(error.message);
    }
    return {
      email: data.user?.email || "",
      role: data.user?.user_metadata.role || "",
      matricNumber: data.user?.user_metadata.matric_number || "",
      phoneNumber: data.user?.user_metadata.phone_number || "",
      fullName: data.user?.user_metadata.full_name || "",
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
      email: data.user?.email || "",
      role: data.user?.user_metadata.role || "",
      matricNumber: data.user?.user_metadata.matricNumber || "",
      phoneNumber: data.user?.user_metadata.phoneNumber || "",
      fullName: data.user?.user_metadata.fullName || "",
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
