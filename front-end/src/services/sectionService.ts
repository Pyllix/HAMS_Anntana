import axios from "axios";
import { Section } from "../types/TypeAsset";

export async function getSectionById(id: string): Promise<Section> {
  const token = localStorage.getItem("token");

  const res = await axios.get(
    `https://hams-anntana.onrender.com/sections/${id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return res.data;
}
