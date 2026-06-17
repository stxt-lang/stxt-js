import { regexType } from "./regexType";

export const EMAIL = regexType("EMAIL",
    /^(?=.{1,256}$)(?=.{1,64}@.{1,255}$)(?=.{1,64}@.{1,63}\..{1,63}$)[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
  "Invalid email"
);
