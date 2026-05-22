import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "auth",
  initialState: {
    accessToken: null,
    refreshToken: null,
    user: null,
  },
  reducers: {
    setCredentials: (state, action) => {
      state.accessToken = action.payload.access;
      state.refreshToken = action.payload.refresh;
      state.user = action.payload.user;
    },
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
    },
    logout: (state) => {
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;
    },
  },
});

export const { setCredentials, setAccessToken, logout } = authSlice.actions;

// Selectors
export const selectCurrentUser = (state) => state?.auth?.user;
export const selectAccessToken = (state) => state?.auth?.accessToken;
export const selectRefreshToken = (state) => state?.auth?.refreshToken;
export const selectUserType = (state) => state?.auth?.user?.user_type;
export const selectSchoolName = (state) => state?.auth?.user?.school_name;
export const selectIsAdmin = (state) => state?.auth?.user?.user_type === "1";

export default authSlice.reducer;
