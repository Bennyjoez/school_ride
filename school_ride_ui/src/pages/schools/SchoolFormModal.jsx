// src/pages/schools/SchoolFormModal.jsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSchool, updateSchool } from "../../api/endpoints/resources";
import { Modal, Button, Input, ErrorMessage } from "../../components/ui";
import { TIMEZONES } from "../../hooks/constants";

export function SchoolFormModal({ open, onClose, school }) {
  const isEdit = Boolean(school);
  const queryClient = useQueryClient();
  const [apiError, setApiError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setApiError(null);
      reset(
        isEdit
          ? {
              name: school.name,
              region: school.region,
              timezone: school.timezone,
            }
          : {
              timezone: "Africa/Nairobi", // sensible default
            },
      );
    }
  }, [isEdit, open, reset, school]);

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? updateSchool(school.id, data) : createSchool(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      onClose();
    },
    onError: (err) => setApiError(err),
  });

  async function onSubmit(data) {
    setApiError(null);
    await mutation.mutateAsync(data);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit School" : "Create School"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <ErrorMessage error={apiError} />

        <Input
          label="School name"
          placeholder="Westlands Academy"
          error={errors.name?.message}
          {...register("name", { required: "School name is required" })}
        />

        <Input
          label="Region"
          placeholder="Nairobi County"
          error={errors.region?.message}
          {...register("region", { required: "Region is required" })}
        />

        {/* Timezone — select from common options */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Timezone</label>
          <select
            className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              ${errors.timezone ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"}`}
            {...register("timezone", { required: "Timezone is required" })}
          >
            <option value="">Select timezone</option>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          {errors.timezone && (
            <p className="text-xs text-red-600">{errors.timezone.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Create school"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
