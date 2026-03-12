export interface UserCreationRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface Token {
  token: string;
  expiredAt: number;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
}

export interface LoginResponse {
  user: UserResponse;
  accessToken: Token;
}
