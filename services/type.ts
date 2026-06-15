export interface User {
  email: string;
  password: string;
  role: string;
  matricNumber: string;
  phoneNumber: string;
  fullName: string;
}

export interface Response {
  email: string;
  role: string;
  matricNumber: string;
  phoneNumber: string;
  fullName: string;
  token: string;
}

export interface Course {
  course_code: string;
  title: string;
  level: number;
}
