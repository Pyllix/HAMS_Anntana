import axios from "axios";
import { User } from "../types/TypeUser";

// import { user } from "../mockData/data";
// import { User } from "../types/TypeUser";

// export const authLogin = (email: string, password: string): User | null => {
//   const userLogin = user.find(
//     (u) => u.email === email && u.password_hash === password,
//   );

//   if (!userLogin || userLogin.deleteAt !== null) {
//     console.log("User not found or deleted");
//     return null;
//   }
//   console.log("User found:", userLogin);
//   return userLogin;
// };

interface loginSucces {
  token: string;
  user: User;
}

export async function authLogin(
  email: string,
  password: string,
): Promise<loginSucces> {
  const res = await axios.post(
    "https://hams-anntana.onrender.com/auth/sign-in",
    { email, password },
  );

  const token = res.data.token;
  const userId = res.data.user.id;
  const user = await axios.get(
    `https://hams-anntana.onrender.com/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return { token: token, user: user.data };
}
