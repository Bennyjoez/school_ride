import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { getMe, updateMe, changePassword } from "../../api/endpoints/users";
import {
  setCredentials,
  selectCurrentUser,
  selectAccessToken,
  selectRefreshToken,
} from "../../store/authSlice";
import { Button, Input, ErrorMessage, Badge } from "../../components/ui";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "../../hooks/constants";

// Avatar 
export function Avatar({ name, size = 'lg' }) {
  const sizes = {
    lg: 'w-20 h-20 text-2xl',
    md: 'w-12 h-12 text-lg',
  }
  return (
    <div className={`${sizes[size]} rounded-full bg-primary-100 text-primary-700
      flex items-center justify-center font-bold shrink-0`}>
      {name?.charAt(0).toUpperCase() ?? '?'}
    </div>
  )
}

// Info row 

export function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 border-b border-gray-50 last:border-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide sm:w-36 shrink-0">
        {label}
      </span>
      <span className="text-sm text-gray-700">{value ?? '—'}</span>
    </div>
  )
}

// Edit profile form 

export function EditProfileForm({ user, onSuccess }) {
  const dispatch      = useDispatch()
  const accessToken   = useSelector(selectAccessToken)
  const refreshToken  = useSelector(selectRefreshToken)
  const [apiError, setApiError] = useState(null)
  const [saved,    setSaved]    = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm({
    defaultValues: {
      name:         user?.name         ?? '',
      phone_number: user?.phone_number ?? '',
      bio:          user?.bio          ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: data => updateMe(data),
    onSuccess: res => {
      // Update Redux store so sidebar name updates immediately
      dispatch(setCredentials({
        access:  accessToken,
        refresh: refreshToken,
        user:    res.data,
      }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onSuccess?.()
    },
    onError: err => setApiError(err),
  })

  return (
    <form onSubmit={handleSubmit(d => mutation.mutateAsync(d))} className="space-y-4">
      <ErrorMessage error={apiError} />

      <Input
        label="Full name"
        error={errors.name?.message}
        {...register('name', { required: 'Name is required' })}
      />

      <Input
        label="Phone number"
        placeholder="+254700000000"
        error={errors.phone_number?.message}
        {...register('phone_number', { required: 'Phone is required' })}
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Bio</label>
        <textarea
          rows={3}
          placeholder="A short bio or note about yourself..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          {...register('bio')}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          Save changes
        </Button>
        {saved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Saved
          </span>
        )}
      </div>
    </form>
  )
}

// Change password form 

export function ChangePasswordForm() {
  const [apiError, setApiError] = useState(null)
  const [saved,    setSaved]    = useState(false)

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm()

  const mutation = useMutation({
    mutationFn: data => changePassword(data),
    onSuccess: () => {
      reset()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: err => setApiError(err),
  })

  const newPassword = watch('new_password')

  return (
    <form onSubmit={handleSubmit(d => mutation.mutateAsync(d))} className="space-y-4">
      <ErrorMessage error={apiError} />

      <Input
        label="Current password"
        type="password"
        placeholder="••••••••"
        error={errors.old_password?.message}
        {...register('old_password', { required: 'Current password is required' })}
      />

      <Input
        label="New password"
        type="password"
        placeholder="Min. 8 characters"
        error={errors.new_password?.message}
        {...register('new_password', {
          required:  'New password is required',
          minLength: { value: 8, message: 'Minimum 8 characters' },
        })}
      />

      <Input
        label="Confirm new password"
        type="password"
        placeholder="Repeat new password"
        error={errors.confirm_password?.message}
        {...register('confirm_password', {
          required: 'Please confirm your password',
          validate: v => v === newPassword || 'Passwords do not match',
        })}
      />

      <div className="flex items-center gap-3">
        <Button type="submit" loading={isSubmitting}>
          Update password
        </Button>
        {saved && (
          <span className="text-sm text-green-600 font-medium flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Password updated
          </span>
        )}
      </div>
    </form>
  )
}

// Section card 

export function SectionCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// Tab bar 

export function Tabs({ active, onChange }) {
  const tabs = [
    { key: 'info',     label: 'Profile info'    },
    { key: 'edit',     label: 'Edit profile'    },
    { key: 'password', label: 'Change password' },
  ]
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
            active === tab.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}