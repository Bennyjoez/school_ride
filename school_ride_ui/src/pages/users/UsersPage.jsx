import { useQuery } from "@tanstack/react-query";
import { UsersTable } from "./components";
import { getUsers } from "../../api/endpoints/users";
import { UserFormModal } from "./UserFormModal";
import { useState } from "react";

export default function UsersPage() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((r) => r.data),
  });

  const handleEdit = (user) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">Users</h1>
      <UsersTable users={users || []} loading={isLoading} handleEdit={handleEdit} />
      {isEditModalOpen && (
        <UserFormModal
          open={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          user={selectedUser}
        />
      )}
    </div>
  )
}
