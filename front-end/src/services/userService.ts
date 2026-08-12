import axios from "axios";
import { User } from "../types/TypeUser";

export async function getUserById(id: string): Promise<User> {
  const token = localStorage.getItem("token");

  const res = await axios.get(`https://hams-anntana.onrender.com/users/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
}
