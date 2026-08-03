import type { TypeUser } from "../Types/TypeUser";

export const user: TypeUser[] = [
  {
    user_id: "USR-001",
    user_name: "admin_somchai",
    first_name: "สมชาย",
    last_name: "วิเศษกุล",
    email: "somchai.a@hospital.mail",
    password_hash: "$2b$10$EpRnTzWlqHNP0.1234567890abcdefghijklmnopqrstuvwxyz1", // hashed password ตัวอย่าง
    section_id: "SEC-IT-01",
    role: "admin",
    image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=somchai",
  },
  {
    user_id: "USR-002",
    user_name: "inv_siriporn",
    first_name: "ศิริพร",
    last_name: "มั่นคง",
    email: "siriporn.m@hospital.mail",
    password_hash: "$2b$10$EpRnTzWlqHNP0.1234567890abcdefghijklmnopqrstuvwxyz2",
    section_id: "SEC-INV-01",
    role: "inventory_officer",
    image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=siriporn",
  },
  {
    user_id: "USR-003",
    user_name: "nurse_kanya",
    first_name: "กัญญา",
    last_name: "รักสงบ",
    email: "kanya.r@hospital.mail",
    password_hash: "$2b$10$EpRnTzWlqHNP0.1234567890abcdefghijklmnopqrstuvwxyz3",
    section_id: "SEC-ER-01", // แผนกฉุกเฉิน (ER)
    role: "user",
    image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=kanya",
  },
  {
    user_id: "USR-004",
    user_name: "tech_witthaya",
    first_name: "วิทยา",
    last_name: "ชาญช่าง",
    email: "witthaya.c@hospital.mail",
    password_hash: "$2b$10$EpRnTzWlqHNP0.1234567890abcdefghijklmnopqrstuvwxyz4",
    section_id: "SEC-ENG-01", // วิศวกรรมชีวการแพทย์ (Biomedical)
    role: "technician",
    image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=witthaya",
  },
  {
    user_id: "USR-005",
    user_name: "doc_prasonk",
    first_name: "นพ.ประสงค์",
    last_name: "เจริญสุข",
    email: "prasong.j@hospital.mail",
    password_hash: "$2b$10$EpRnTzWlqHNP0.1234567890abcdefghijklmnopqrstuvwxyz5",
    section_id: "SEC-ICU-01", // ผู้จัดการ / หัวหน้าแผนก ICU
    role: "manager",
    image_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=prasong",
  },
];
