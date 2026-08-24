export interface User {
  email: string;
  password: string;
  role: string;
  matricNumber: string;
  phoneNumber: string;
  fullName: string;
  department: string;
  level: string;
}

export interface Response {
  id: string;
  email: string;
  role: string;
  matricNumber: string;
  phoneNumber: string;
  fullName: string;
  token: string;
  imageurl: string;
  imageprofile: string;
  level: string;
  department: string;
  isEnrolled: boolean;
}

export interface Course {
  course_code: string;
  title: string;
  level: number;
}
