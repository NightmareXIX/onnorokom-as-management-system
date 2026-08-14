import { z } from "zod";

/**
 * Every form in the app validates through one of these zod schemas via
 * `@hookform/resolvers/zod`. They live together so the client-side rules stay in
 * step with the backend's (marks bounds, required class for a Student, etc.).
 */

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional();

const wholeNumber = (value: string) => /^\d+$/.test(value.trim());

// --- Auth -----------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// --- Assignments ----------------------------------------------------------

const MAX_MARKS_LIMIT = 1000;

const assignmentFields = z.object({
  title: requiredText("Title", 200),
  description: requiredText("Description", 4000),
  classId: z.string().min(1, "Select a class"),
  subjectId: z.string().min(1, "Select a subject"),
  deadline: z
    .string()
    .min(1, "Deadline is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time"),
  maxMarks: z
    .string()
    .min(1, "Max marks is required")
    .refine(
      (v) => wholeNumber(v) && Number(v) >= 1 && Number(v) <= MAX_MARKS_LIMIT,
      `Enter a whole number between 1 and ${MAX_MARKS_LIMIT}`
    ),
  allowResubmission: z.boolean(),
  status: z.enum(["Draft", "Published"]),
});

/** Creating an assignment with a deadline already in the past would be unusable. */
export const createAssignmentSchema = assignmentFields.refine(
  (values) => Date.parse(values.deadline) > Date.now(),
  { message: "Deadline must be in the future", path: ["deadline"] }
);

/**
 * Editing keeps every rule except the future-deadline one — a teacher may need to
 * fix a typo on an assignment whose deadline has already passed — and drops
 * `status`, which only moves through the dedicated publish action.
 */
export const editAssignmentSchema = assignmentFields.omit({ status: true });

export type CreateAssignmentFormValues = z.infer<typeof createAssignmentSchema>;
export type EditAssignmentFormValues = z.infer<typeof editAssignmentSchema>;

// --- Submissions ----------------------------------------------------------

export const submissionSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Please write an answer before submitting")
    .max(10000, "Answer must be 10000 characters or fewer"),
});

export type SubmissionFormValues = z.infer<typeof submissionSchema>;

/** Mirrors the backend's Uploads:MaxSizeBytes/Uploads:AllowedExtensions defaults, for
 * immediate client-side feedback — the server re-validates regardless. */
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".zip",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
];

export function validateSubmissionFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `File must be ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB or smaller`;
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(extension)) {
    return `That file type isn't allowed. Allowed types: ${ALLOWED_UPLOAD_EXTENSIONS.join(", ")}`;
  }
  return null;
}

/** Marks bounds depend on the assignment, so the schema is built per assignment. */
export const buildGradeSchema = (maxMarks: number) =>
  z.object({
    marks: z
      .string()
      .min(1, "Marks is required")
      .refine(
        (v) => wholeNumber(v) && Number(v) <= maxMarks,
        `Enter a whole number between 0 and ${maxMarks}`
      ),
    feedback: optionalText("Feedback", 2000),
  });

export type GradeFormValues = z.infer<ReturnType<typeof buildGradeSchema>>;

// --- Admin ----------------------------------------------------------------

const roleField = z.enum(["Admin", "Teacher", "Student"]);

const studentNeedsClass = {
  check: (data: { role: "Admin" | "Teacher" | "Student"; classId?: string }) =>
    data.role !== "Student" || !!data.classId,
  options: { message: "Select a class for a Student account", path: ["classId"] },
};

export const createUserSchema = z
  .object({
    fullName: requiredText("Full name", 120),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password must be 100 characters or fewer"),
    role: roleField,
    classId: z.string().optional(),
  })
  .refine(studentNeedsClass.check, studentNeedsClass.options);

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const editUserSchema = z
  .object({
    fullName: requiredText("Full name", 120),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    role: roleField,
    classId: z.string().optional(),
    isActive: z.boolean(),
  })
  .refine(studentNeedsClass.check, studentNeedsClass.options);

export type EditUserFormValues = z.infer<typeof editUserSchema>;

export const classSchema = z.object({
  name: requiredText("Name", 100),
  description: optionalText("Description", 300),
});

export type ClassFormValues = z.infer<typeof classSchema>;

export const subjectSchema = z.object({
  name: requiredText("Name", 100),
  code: optionalText("Code", 20),
});

export type SubjectFormValues = z.infer<typeof subjectSchema>;

export const teacherAssignmentSchema = z.object({
  teacherId: z.string().min(1, "Select a teacher"),
  subjectId: z.string().min(1, "Select a subject"),
  classId: z.string().min(1, "Select a class"),
});

export type TeacherAssignmentFormValues = z.infer<typeof teacherAssignmentSchema>;
