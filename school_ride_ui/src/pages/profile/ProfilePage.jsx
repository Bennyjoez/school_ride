// src/pages/profile/ProfilePage.jsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { format } from "date-fns";
import { getMe } from "../../api/endpoints/users";
import {
  selectCurrentUser,
} from "../../store/authSlice";
import { Badge } from "../../components/ui";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "../../hooks/constants";
import { Avatar, ChangePasswordForm, EditProfileForm, InfoRow, SectionCard, Tabs } from "./Components";

// Main page
export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("info");
  const currentUser = useSelector(selectCurrentUser);
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMe().then((r) => r.data),
    initialData: currentUser, // show Redux data immediately while fetching
  });

  if (isLoading && !user) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const role = ROLE_LABELS[user?.user_type] ?? "User";
  const roleColor = ROLE_BADGE_VARIANT[user?.user_type] ?? "default";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Profile header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-6">
        <div className="flex items-start gap-5">
          <Avatar name={user?.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {user?.name}
              </h1>
              <Badge variant={roleColor}>{role}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
            {user?.school_name && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16"
                  />
                </svg>
                {user.school_name}
              </p>
            )}
            {user?.bio && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                {user.bio}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <Tabs active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "info" && (
        <SectionCard
          title="Account details"
          subtitle="Your account information as stored in the system."
        >
          <InfoRow label="Full name" value={user?.name} />
          <InfoRow label="Email" value={user?.email} />
          <InfoRow label="Phone" value={user?.phone_number} />
          <InfoRow
            label="Role"
            value={<Badge variant={roleColor}>{role}</Badge>}
          />
          <InfoRow label="School" value={user?.school_name} />
          <InfoRow label="Bio" value={user?.bio} />
          {
            user?.last_login && (
              <InfoRow
                label="Last login"
                value={
                  user?.last_login
                    ? format(new Date(user.last_login), "dd MMM yyyy, HH:mm")
                    : "Never"
            }
          />
          )}
          <InfoRow
            label="Member since"
            value={
              user?.date_joined
                ? format(new Date(user.date_joined), "dd MMM yyyy")
                : "—"
            }
          />
        </SectionCard>
      )}

      {activeTab === "edit" && (
        <SectionCard
          title="Edit profile"
          subtitle="Update your name, phone number, and bio."
        >
          <EditProfileForm
            user={user}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["me"] });
              setActiveTab("info");
            }}
          />
        </SectionCard>
      )}

      {activeTab === "password" && (
        <SectionCard
          title="Change password"
          subtitle="Choose a strong password of at least 8 characters."
        >
          <ChangePasswordForm />
        </SectionCard>
      )}
    </div>
  );
}
