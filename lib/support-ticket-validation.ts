import type { SupportTicketType } from "@prisma/client";

export const SUPPORT_TICKET_TYPES: SupportTicketType[] = ["BUG", "SUGGESTION"];

export const SUPPORT_SUBJECT_MIN = 3;
export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_MESSAGE_MIN = 3;
export const SUPPORT_MESSAGE_MAX = 4000;

export type SupportTicketCreateInput = {
  type?: SupportTicketType;
  subject?: string;
  message?: string;
};

export type SupportTicketValidationError =
  | "invalid_body"
  | "invalid_type"
  | "invalid_subject"
  | "subject_too_long"
  | "invalid_message"
  | "message_too_long";

export function validateSupportTicketCreate(
  body: SupportTicketCreateInput,
): { ok: true; data: { type: SupportTicketType; subject: string; message: string } } | { ok: false; error: SupportTicketValidationError } {
  const type = body.type;
  const subject = body.subject?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!type || !SUPPORT_TICKET_TYPES.includes(type)) {
    return { ok: false, error: "invalid_type" };
  }
  if (subject.length < SUPPORT_SUBJECT_MIN) {
    return { ok: false, error: "invalid_subject" };
  }
  if (subject.length > SUPPORT_SUBJECT_MAX) {
    return { ok: false, error: "subject_too_long" };
  }
  if (message.length < SUPPORT_MESSAGE_MIN) {
    return { ok: false, error: "invalid_message" };
  }
  if (message.length > SUPPORT_MESSAGE_MAX) {
    return { ok: false, error: "message_too_long" };
  }

  return { ok: true, data: { type, subject, message } };
}

export function supportTicketErrorKey(
  error: string | undefined,
): keyof typeof SUPPORT_ERROR_KEYS {
  if (error && error in SUPPORT_ERROR_KEYS) {
    return error as keyof typeof SUPPORT_ERROR_KEYS;
  }
  return "unknown";
}

export const SUPPORT_ERROR_KEYS = {
  invalid_body: "errorInvalidBody",
  invalid_type: "errorInvalidType",
  invalid_subject: "errorInvalidSubject",
  subject_too_long: "errorSubjectTooLong",
  invalid_message: "errorInvalidMessage",
  message_too_long: "errorMessageTooLong",
  unknown: "errorCreate",
} as const;
