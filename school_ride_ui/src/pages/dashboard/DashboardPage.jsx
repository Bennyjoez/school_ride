// src/pages/dashboard/DashboardPage.jsx
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { selectCurrentUser } from "../../store/authSlice";
import { getUsers } from "../../api/endpoints/users";
import {
  getSchools,
  getVehicles,
  getRoutes,
  getTrips,
  getStudents,
} from "../../api/endpoints/resources";
import {
  StatCard,
  SectionHeader,
  RecentTripsTable,
  QuickLink,
  EmptyState,
  TripStatusBadge,
} from "./components";
import { ROLE_LABELS } from "../../hooks/constants";
import { FleetMap } from "./Fleetmap";

export default function DashboardPage() {
  const user = useSelector(selectCurrentUser);
  const dashboards = {
    1: AdminDashboard,
    2: DirectorDashboard,
    3: DirectorDashboard,
    4: TeacherDashboard,
    5: DriverDashboard,
    6: GuardianDashboard,
  };
  const Dashboard = dashboards[user?.user_type] ?? FallbackDashboard;
  return <Dashboard user={user} />;
}

// Greeting
function Greeting({ user }) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="mb-8">
      <p className="text-xs font-medium text-primary-600 uppercase tracking-widest mb-1">
        {ROLE_LABELS[user?.user_type]}
      </p>
      <h1 className="text-2xl font-bold text-gray-900">
        {greeting}, {user?.name?.split(" ")[0]}
      </h1>
      {user?.school_name && (
        <p className="text-sm text-gray-500 mt-0.5">{user.school_name}</p>
      )}
    </div>
  );
}

// 
// ADMIN
// 
function AdminDashboard({ user }) {
  const { data: schools, isLoading: ls } = useQuery({
    queryKey: ["schools"],
    queryFn: () => getSchools().then((r) => r.data),
  });
  const { data: users, isLoading: lu } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((r) => r.data),
  });
  const { data: trips, isLoading: lt } = useQuery({
    queryKey: ["trips"],
    queryFn: () => getTrips().then((r) => r.data),
  });

  const activeSchools = schools?.filter((s) => s.is_active).length ?? 0;
  const activeUsers = users?.filter((u) => u.is_active).length ?? 0;
  const activeTrips = trips?.filter((t) => t.status === "active") ?? [];
  const recentTrips = trips?.slice(0, 6) ?? [];

  return (
    <div>
      <Greeting user={user} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Schools"
          value={activeSchools}
          color="blue"
          loading={ls}
          linkTo="/schools"
          icon={<SchoolIcon />}
        />
        <StatCard
          label="Active Users"
          value={activeUsers}
          color="purple"
          loading={lu}
          linkTo="/users"
          icon={<UsersIcon />}
        />
        <StatCard
          label="Active Trips"
          value={activeTrips.length}
          color="green"
          loading={lt}
          linkTo="/trips"
          icon={<TripIcon />}
        />
        <StatCard
          label="Total Schools"
          value={schools?.length ?? 0}
          color="amber"
          loading={ls}
          linkTo="/schools"
          icon={<GlobeIcon />}
        />
      </div>

      <FleetMap height="380px"  />


      {activeTrips.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-200 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
          <p className="text-sm text-green-800 font-medium">
            {activeTrips.length} trip{activeTrips.length > 1 ? "s" : ""}{" "}
            currently active across all schools
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionHeader
            title="Recent Trips"
            action={
              <Link
                to="/trips"
                className="text-xs text-primary-600 hover:underline"
              >
                View all
              </Link>
            }
          />
          <RecentTripsTable trips={recentTrips} loading={lt} />
        </div>
        <div>
          <SectionHeader title="Quick Access" />
          <div className="space-y-3">
            <QuickLink
              to="/schools"
              label="Manage Schools"
              icon={<SchoolIcon />}
              description="Add or deactivate schools"
            />
            <QuickLink
              to="/users"
              label="Manage Users"
              icon={<UsersIcon />}
              description="Create and manage accounts"
            />
            <QuickLink
              to="/trips"
              label="View Trips"
              icon={<TripIcon />}
              description="Monitor all active trips"
            />
            <QuickLink
              to="/vehicles"
              label="Fleet"
              icon={<VehicleIcon />}
              description="Vehicles and routes"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// 
// DIRECTOR / MANAGER
// 
function DirectorDashboard({ user }) {
  const isManager = user?.user_type === "3";
  const { data: vehicles, isLoading: lv } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehicles().then((r) => r.data),
  });
  const { data: routes, isLoading: lr } = useQuery({
    queryKey: ["routes"],
    queryFn: () => getRoutes().then((r) => r.data),
  });
  const { data: students, isLoading: ls } = useQuery({
    queryKey: ["students"],
    queryFn: () => getStudents().then((r) => r.data),
  });
  const { data: trips, isLoading: lt } = useQuery({
    queryKey: ["trips"],
    queryFn: () => getTrips().then((r) => r.data),
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const tripsToday = trips?.filter((t) => t.trip_date === today) ?? [];
  const activeVehicles =
    vehicles?.filter((v) => v.status === "in_service").length ?? 0;
  const activeRoutes = routes?.filter((r) => r.is_active).length ?? 0;
  const totalStudents = students?.filter((s) => s.is_active).length ?? 0;
  const recentTrips = trips?.slice(0, 6) ?? [];

  return (
    <div>
      <Greeting user={user} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Active Vehicles"
          value={activeVehicles}
          color="amber"
          loading={lv}
          linkTo="/vehicles"
          icon={<VehicleIcon />}
        />
        <StatCard
          label="Active Routes"
          value={activeRoutes}
          color="blue"
          loading={lr}
          linkTo="/routes"
          icon={<RouteIcon />}
        />
        <StatCard
          label="Students"
          value={totalStudents}
          color="purple"
          loading={ls}
          linkTo="/students"
          icon={<UsersIcon />}
        />
        <StatCard
          label="Trips Today"
          value={tripsToday.length}
          color="green"
          loading={lt}
          linkTo="/trips"
          icon={<TripIcon />}
        />
      </div>

      <FleetMap height="380px"  />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionHeader
            title="Recent Trips"
            action={
              <Link
                to="/trips"
                className="text-xs text-primary-600 hover:underline"
              >
                View all
              </Link>
            }
          />
          <RecentTripsTable trips={recentTrips} loading={lt} />
        </div>
        <div>
          <SectionHeader title="Quick Access" />
          <div className="space-y-3">
            <QuickLink
              to="/vehicles"
              label="Fleet"
              icon={<VehicleIcon />}
              description="Vehicles and assign drivers"
            />
            <QuickLink
              to="/routes"
              label="Routes"
              icon={<RouteIcon />}
              description="Manage routes and stops"
            />
            <QuickLink
              to="/students"
              label="Students"
              icon={<UsersIcon />}
              description="Students and assignments"
            />
            <QuickLink
              to="/trips"
              label="Trips"
              icon={<TripIcon />}
              description="Schedule and monitor trips"
            />
            {!isManager && (
              <QuickLink
                to="/users"
                label="Staff"
                icon={<SchoolIcon />}
                description="Manage school users"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 
// TEACHER
// 
function TeacherDashboard({ user }) {
  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: () => getTrips().then((r) => r.data),
  });
  const today = format(new Date(), "yyyy-MM-dd");
  const todayTrips = trips?.filter((t) => t.trip_date === today) ?? [];
  const activeTrips = todayTrips.filter((t) => t.status === "active");

  return (
    <div>
      <Greeting user={user} />
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard
          label="Trips Today"
          value={todayTrips.length}
          color="blue"
          loading={isLoading}
          icon={<TripIcon />}
        />
        <StatCard
          label="Active Now"
          value={activeTrips.length}
          color="green"
          loading={isLoading}
          icon={<TripIcon />}
        />
      </div>
      <SectionHeader title="Today's Trips" />
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-100 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : todayTrips.length === 0 ? (
        <EmptyState
          icon={<TripIcon />}
          title="No trips today"
          message="There are no trips scheduled for today."
        />
      ) : (
        <div className="space-y-3">
          {todayTrips.map((trip) => (
            <div
              key={trip.id}
              className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200 hover:border-primary-200 transition-colors"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {trip.route_name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Driver: {trip.driver_name ?? "—"} ·{" "}
                  {trip.vehicle_plate ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <TripStatusBadge status={trip.status} />
                {trip.status === "active" && (
                  <Link
                    to={`/trips/${trip.id}`}
                    className="text-xs font-medium text-primary-600 hover:underline"
                  >
                    Check in →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 
// DRIVER
// 
function DriverDashboard({ user }) {
  const { data: trips, isLoading } = useQuery({
    queryKey: ["trips"],
    queryFn: () => getTrips().then((r) => r.data),
  });
  const today = format(new Date(), "yyyy-MM-dd");
  const myTrips = trips?.filter((t) => t.trip_date === today) ?? [];
  const activeTrip = myTrips.find((t) => t.status === "active");

  return (
    <div>
      <Greeting user={user} />
      {activeTrip && (
        <Link to={`/trips/${activeTrip.id}`}>
          <div className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-300 flex items-center justify-between hover:bg-green-100 transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-900">
                  Trip in progress
                </p>
                <p className="text-xs text-green-700">
                  {activeTrip.route_name}
                </p>
              </div>
            </div>
            <span className="text-xs font-medium text-green-700">Open →</span>
          </div>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard
          label="Today's Trips"
          value={myTrips.length}
          color="blue"
          loading={isLoading}
          icon={<TripIcon />}
        />
        <StatCard
          label="Status"
          value={activeTrip ? "On Trip" : "Available"}
          color={activeTrip ? "green" : "amber"}
          loading={isLoading}
          icon={<VehicleIcon />}
        />
      </div>
      <SectionHeader title="Today's Schedule" />
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : myTrips.length === 0 ? (
        <EmptyState
          icon={<VehicleIcon />}
          title="No trips today"
          message="You have no trips scheduled for today."
        />
      ) : (
        <div className="space-y-3">
          {myTrips.map((trip) => (
            <Link key={trip.id} to={`/trips/${trip.id}`}>
              <div className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {trip.route_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Vehicle:{" "}
                      <span className="font-mono">
                        {trip.vehicle_plate ?? "—"}
                      </span>
                    </p>
                  </div>
                  <TripStatusBadge status={trip.status} />
                </div>
                <p className="text-xs mt-3 font-medium text-primary-600">
                  {trip.status === "scheduled" && "Tap to start trip →"}
                  {trip.status === "active" &&
                    "Trip in progress — tap to manage →"}
                  {trip.status === "completed" && (
                    <span className="text-gray-400">Completed</span>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// 
// GUARDIAN
// 
function GuardianDashboard({ user }) {
  const { data: students, isLoading: ls } = useQuery({
    queryKey: ["students"],
    queryFn: () => getStudents().then((r) => r.data),
  });
  const { data: trips, isLoading: lt } = useQuery({
    queryKey: ["trips"],
    queryFn: () => getTrips().then((r) => r.data),
  });

  const today = format(new Date(), "yyyy-MM-dd");
  const activeTrips =
    trips?.filter((t) => t.status === "active" && t.trip_date === today) ?? [];

  return (
    <div>
      <Greeting user={user} />

      {activeTrips.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Bus is currently running
          </p>
          <div className="flex flex-wrap gap-2">
            {activeTrips.map((trip) => (
              <Link
                key={trip.id}
                to={`/trips/${trip.id}`}
                className="text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-full transition-colors"
              >
                Track {trip.route_name} →
              </Link>
            ))}
          </div>
        </div>
      )}

      <SectionHeader title="My Children" />
      {ls ? (
        <div className="space-y-2 mb-8">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : !students?.length ? (
        <div className="mb-8">
          <EmptyState
            icon={<UsersIcon />}
            title="No children linked"
            message="Contact the school to link your children to your account."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {students.map((student) => (
            <div
              key={student.id}
              className="p-4 bg-white rounded-2xl border border-gray-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {student.full_name}
                  </p>
                  <p className="text-xs text-gray-500">Grade {student.grade}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${student.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {student.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {student.route_assignments?.length > 0 ? (
                <div className="space-y-1 mt-3">
                  {student.route_assignments.map((a) => (
                    <p
                      key={a.id}
                      className="text-xs text-gray-500 flex items-center gap-1"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0" />
                      {a.route_name} — {a.stop_name} ({a.direction})
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-2">No route assigned</p>
              )}
              <p className="text-xs font-mono text-gray-400 mt-3">
                Code: {student.student_code}
              </p>
            </div>
          ))}
        </div>
      )}

      <SectionHeader title="Today's Activity" />
      {lt ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-12 bg-gray-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : activeTrips.length === 0 ? (
        <EmptyState
          icon={<TripIcon />}
          title="No active trips"
          message="There are no buses running right now."
        />
      ) : (
        <div className="space-y-3">
          {activeTrips.map((trip) => (
            <div
              key={trip.id}
              className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200"
            >
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {trip.route_name}
                </p>
                <p className="text-xs text-gray-500">
                  {trip.driver_name ?? "Driver not assigned"}
                </p>
              </div>
              <Link
                to={`/trips/${trip.id}`}
                className="text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-full transition-colors"
              >
                Live map →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 
// FALLBACK
// 
function FallbackDashboard({ user }) {
  return (
    <div>
      <Greeting user={user} />
      <p className="text-sm text-gray-500">
        Dashboard not configured for this role.
      </p>
    </div>
  );
}

// Icon─
const SchoolIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);
const UsersIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);
const TripIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);
const VehicleIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
    />
  </svg>
);
const RouteIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
    />
  </svg>
);
const GlobeIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);
