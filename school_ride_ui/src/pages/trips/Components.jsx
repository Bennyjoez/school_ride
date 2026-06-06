import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  createTrip, getRoutes, getVehicles,
} from '../../api/endpoints/resources'
import { getDrivers } from '../../api/endpoints/users'
import {
  Button, Input, Select,
  Modal, Badge, ErrorMessage,
} from '../../components/ui'
import { TRIP_STATUS_BADGE } from '../../hooks/constants'


// Trip form modal
export function TripFormModal({ open, onClose }) {
  const queryClient = useQueryClient()
  const [apiError, setApiError] = useState(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm()

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: () => getRoutes().then(r => r.data.filter(r => r.is_active)),
    enabled: open,
  })

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles', 'available'],
    queryFn: () => getVehicles().then(r => r.data.filter(v => v.status === 'available')),
    enabled: open,
  })

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => getDrivers().then(r => r.data),
    enabled: open,
  })

  useState(() => {
    if (open) { setApiError(null); reset({ trip_date: format(new Date(), 'yyyy-MM-dd') }) }
  }, [open])

  const mutation = useMutation({
    mutationFn: data => createTrip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      onClose()
    },
    onError: err => setApiError(err),
  })

  return (
    <Modal open={open} onClose={onClose} title="Schedule Trip">
      <form onSubmit={handleSubmit(d => mutation.mutateAsync(d))} className="space-y-4">
        <ErrorMessage error={apiError} />

        <Select label="Route" error={errors.route?.message}
          {...register('route', { required: 'Route is required' })}>
          <option value="">Select a route</option>
          {routes?.map(r => (
            <option key={r.id} value={r.id}>{r.name} ({r.direction})</option>
          ))}
        </Select>

        <Input label="Trip date" type="date" error={errors.trip_date?.message}
          {...register('trip_date', { required: 'Date is required' })} />

        <Select label="Vehicle" error={errors.vehicle?.message}
          {...register('vehicle', { required: 'Vehicle is required' })}>
          <option value="">Select a vehicle</option>
          {vehicles?.map(v => (
            <option key={v.id} value={v.id}>{v.license_plate} ({v.capacity} seats)</option>
          ))}
        </Select>

        <Select label="Driver" error={errors.driver?.message}
          {...register('driver', { required: 'Driver is required' })}>
          <option value="">Select a driver</option>
          {drivers?.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Schedule trip</Button>
        </div>
      </form>
    </Modal>
  )
}

// Status badge
export function TripStatusBadge({ status }) {
  const STATUS_LABEL = {
    scheduled: 'Scheduled',
    active:    'Active',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return (
    <Badge variant={TRIP_STATUS_BADGE[status] ?? 'default'}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

// Trips table
export function TripsTable({ trips, loading }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!trips?.length) {
    return (
      <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-2xl border border-gray-100">
        No trips found.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {['Route', 'Date', 'Vehicle', 'Driver', 'Status', 'Start', 'End', 'Pings', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-50">
          {trips.map(trip => (
            <tr key={trip.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{trip.route_name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {format(new Date(trip.trip_date), 'dd MMM yyyy')}
              </td>
              <td className="px-4 py-3 text-sm font-mono text-gray-500">
                {trip.vehicle_plate ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {trip.driver_name ?? '—'}
              </td>
              <td className="px-4 py-3">
                <TripStatusBadge status={trip.status} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                {trip.actual_start ? format(new Date(trip.actual_start), 'HH:mm') : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                {trip.actual_end ? format(new Date(trip.actual_end), 'HH:mm') : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-400">
                {trip.pings_count ?? 0}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/trips/${trip.id}`}
                  className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}