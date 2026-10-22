import axiosClient from '../api/axiosClient';

export const authService = {
  login: async (email, password) => {
    const response = await axiosClient.post('/auth/login', {
      email,
      password,
    });

    return response.data;
  },

  register: async (name, email, password) => {
    const response = await axiosClient.post('/auth/register', {
      name,
      email,
      password,
    });
    return response.data;
  },

  getCurrentProfile: async () => {
    const response = await axiosClient.get('/auth/me');
    return response.data;
  },
};
