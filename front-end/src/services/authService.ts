import { user } from "../mockData/data";
import { User } from "../types/TypeUser";

export const authLogin = (email: string, password: string): User | null => {
  const userLogin = user.find(
    (u) => u.email === email && u.password_hash === password,
  );

  if (!userLogin || userLogin.deleteAt !== null) {
    console.log("User not found or deleted");
    return null;
  }
  console.log("User found:", userLogin);
  return userLogin;
};
