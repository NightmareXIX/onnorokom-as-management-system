export enum UserRole {
  Admin = 0,
  Teacher = 1,
  Student = 2,
}

export enum AssignmentStatus {
  Draft = 0,
  Published = 1,
}

export enum SubmissionStatus {
  Submitted = 0,
  Graded = 1,
  ReturnedForRevision = 2,
}

export interface LoginResponse {
  token: string;
  role: UserRole;
  fullName: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  classId: string | null;
}

export interface ClassOption {
  id: string;
  name: string;
  description: string | null;
}

export interface SubjectOption {
  id: string;
  name: string;
  code: string | null;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  deadline: string;
  maxMarks: number;
  status: AssignmentStatus;
  allowResubmission: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface Submission {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  content: string;
  status: SubmissionStatus;
  marks: number | null;
  feedback: string | null;
  submittedAt: string;
  updatedAt: string | null;
  gradedAt: string | null;
  gradedByTeacherId: string | null;
}

export interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
}
