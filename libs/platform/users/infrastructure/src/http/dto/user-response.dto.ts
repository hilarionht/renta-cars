export class UserResponseDto {
  id!: string;
  email!: string;
  name!: string;
  status!: string;
  roles!: string[];
  branchId?: string;
}
