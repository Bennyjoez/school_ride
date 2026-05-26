// src/pages/users/UserFormModal.jsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createUser, updateUser } from "../../api/endpoints/users";
import { getSchools } from "../../api/endpoints/resources";
import { useSelector } from "react-redux";
import { selectCurrentUser, selectIsAdmin } from "../../store/authSlice";
import {
  Modal,
  Button,
  Input,
  Select,
  ErrorMessage,
} from "../../components/ui";
import { useState } from "react";
import { ADMIN_USER_TYPES, USER_TYPES } from "../../hooks/constants";

export function UserFormModal({ open, onClose, user }) {
  const isEdit = Boolean(user);
  const currentUser = useSelector(selectCurrentUser);
  const isAdmin = useSelector(selectIsAdmin);
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState(null);

  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => getSchools().then((r) => r.data),
    enabled: isAdmin, // only admins pick a school
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  // Populate form when editing
  useEffect(() => {
    if (open) {
      setApiError(null);
      reset(
        isEdit
          ? {
              name: user.name,
              email: user.email,
              phone_number: user.phone_number,
              user_type: user.user_type,
              school: user.school ?? "",
              bio: user.bio ?? "",
            }
          : {},
      );
    }
  }, [open, user]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? updateUser(user.id, data) : createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (err) => setApiError(err),
  });

  async function onSubmit(data) {
    setApiError(null);
    // Non-admin users - school is injected server-side by SchoolScopedMixin
    if (!isAdmin) delete data.school;
    await mutation.mutateAsync(data);
  }

  const typeOptions = isAdmin ? ADMIN_USER_TYPES : USER_TYPES;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Create User"}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <ErrorMessage error={apiError} />

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input
              label="Full name"
              placeholder="Jane Doe"
              error={errors.name?.message}
              {...register("name", { required: "Name is required" })}
            />
          </div>

          <Input
            label="Email"
            type="email"
            placeholder="jane@school.com"
            error={errors.email?.message}
            {...register("email", {
              required: "Email is required",
              pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email" },
            })}
          />

          <Input
            label="Phone number"
            placeholder="+254700000000"
            error={errors.phone_number?.message}
            {...register("phone_number", { required: "Phone is required" })}
          />
        </div>

        <Select
          label="Role"
          error={errors.user_type?.message}
          {...register("user_type", { required: "Role is required" })}
        >
          <option value="">Select a role</option>
          {typeOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>

        {/* School selector - Admin only */}
        {isAdmin && !isEdit && (
          <Select
            label="School"
            error={errors.school?.message}
            {...register("school")}
          >
            <option value="">Select a school (optional)</option>
            {schools?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}

        {/* Password - create only */}
        {!isEdit && (
          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            error={errors.password?.message}
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Minimum 8 characters" },
            })}
          />
        )}

        <Input
          label="Bio (optional)"
          placeholder="Short bio or notes"
          error={errors.bio?.message}
          {...register("bio")}
        />

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Create user"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
