// Hand-written to match supabase/migrations. If you change the schema, either
// update this file or regenerate it with:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export type UserRole = "admin" | "driver" | "student";
export type BusStatus = "active" | "maintenance" | "inactive";
export type TripStatus = "active" | "completed" | "cancelled";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Route = {
  id: string;
  route_name: string;
  start_point: string;
  end_point: string;
  created_at: string;
  updated_at: string;
};

export type Bus = {
  id: string;
  bus_number: string;
  capacity: number;
  status: BusStatus;
  driver_id: string | null;
  route_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Trip = {
  id: string;
  bus_id: string;
  driver_id: string;
  route_id: string | null;
  status: TripStatus;
  started_at: string;
  ended_at: string | null;
};

export type BusLocation = {
  bus_id: string;
  trip_id: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: never;
        Update: Partial<Pick<Profile, "full_name" | "role">>;
        Relationships: [];
      };
      routes: {
        Row: Route;
        Insert: Pick<Route, "route_name" | "start_point" | "end_point"> & Partial<Pick<Route, "id">>;
        Update: Partial<Pick<Route, "route_name" | "start_point" | "end_point">>;
        Relationships: [];
      };
      buses: {
        Row: Bus;
        Insert: Pick<Bus, "bus_number" | "capacity"> &
          Partial<Pick<Bus, "id" | "status" | "driver_id" | "route_id">>;
        Update: Partial<Pick<Bus, "bus_number" | "capacity" | "status" | "driver_id" | "route_id">>;
        Relationships: [
          {
            foreignKeyName: "buses_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "buses_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: Trip;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "trips_bus_id_fkey";
            columns: ["bus_id"];
            isOneToOne: false;
            referencedRelation: "buses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_route_id_fkey";
            columns: ["route_id"];
            isOneToOne: false;
            referencedRelation: "routes";
            referencedColumns: ["id"];
          },
        ];
      };
      bus_locations: {
        Row: BusLocation;
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "bus_locations_bus_id_fkey";
            columns: ["bus_id"];
            isOneToOne: true;
            referencedRelation: "buses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bus_locations_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: UserRole | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      start_trip: { Args: { p_bus_id: string }; Returns: Trip };
      end_trip: { Args: { p_trip_id: string }; Returns: Trip };
      assign_driver: { Args: { p_driver_id: string; p_bus_id: string | null }; Returns: undefined };
      update_bus_location: {
        Args: {
          p_bus_id: string;
          p_latitude: number;
          p_longitude: number;
          p_accuracy?: number | null;
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      bus_status: BusStatus;
      trip_status: TripStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
