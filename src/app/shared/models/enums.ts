export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  TEACHER = 'TEACHER'
}

export enum Visibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  UNLISTED = 'UNLISTED'
}

export enum EnrollmentRole {
  LEARNER = 'LEARNER',
  TEACHER = 'TEACHER'
}

export enum EnrollmentStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REJECTED = 'REJECTED',
  INACTIVE = 'INACTIVE'
}

export enum ExerciseType {
  TEXT_ANSWER = 'TEXT_ANSWER',
  CODE = 'CODE',
  FILE_UPLOAD = 'FILE_UPLOAD',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  PROJECT_LINK = 'PROJECT_LINK'
}

export enum SubmissionStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  NEEDS_REVISION = 'NEEDS_REVISION'
}

export enum QuestionVisibility {
  VISIBLE = 'VISIBLE',
  HIDDEN = 'HIDDEN'
}

export enum QuestionAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}
