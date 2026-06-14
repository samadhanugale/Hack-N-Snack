package com.accenture.smartquiz.service;

import com.accenture.smartquiz.dto.request.CreateUserRequest;
import com.accenture.smartquiz.dto.request.UpdateUserRequest;
import com.accenture.smartquiz.dto.response.AdminUserResponse;
import com.accenture.smartquiz.entity.enums.UserRole;

import java.util.List;

/** Super-admin user management — create/manage SMEs & admins without DB migrations. */
public interface UserAdminService {

    /** @param role optional filter (null = all roles). */
    List<AdminUserResponse> listUsers(UserRole role);

    AdminUserResponse createUser(CreateUserRequest request);

    AdminUserResponse updateUser(Long id, UpdateUserRequest request);

    AdminUserResponse setActive(Long id, boolean active, Long currentUserId);

    void resetPassword(Long id, String newPassword);

    void deleteUser(Long id, Long currentUserId);
}
