CREATE TYPE "public"."booking_status" AS ENUM('RESERVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."seat_type" AS ENUM('STANDARD', 'VIP');--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"showtime_id" uuid NOT NULL,
	"status" "booking_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "booking_id_showtime_id_key" UNIQUE("id","showtime_id")
);
--> statement-breakpoint
CREATE TABLE "booking_seat" (
	"showtime_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	CONSTRAINT "booking_seat_showtime_id_seat_id_pk" PRIMARY KEY("showtime_id","seat_id")
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"booking_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_key_user_id_key_pk" PRIMARY KEY("user_id","key"),
	CONSTRAINT "idempotency_key_key_length" CHECK (char_length("idempotency_key"."key") between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "genre" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "genre_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "movie" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"duration_min" integer NOT NULL,
	"age_limit" integer NOT NULL,
	"release_year" integer NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "movie_duration_min_positive" CHECK ("movie"."duration_min" > 0)
);
--> statement-breakpoint
CREATE TABLE "movie_genre" (
	"movie_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL,
	CONSTRAINT "movie_genre_movie_id_genre_id_pk" PRIMARY KEY("movie_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "cinema_hall" (
	"id" uuid PRIMARY KEY NOT NULL,
	"hall_number" integer NOT NULL,
	CONSTRAINT "cinema_hall_hall_number_unique" UNIQUE("hall_number")
);
--> statement-breakpoint
CREATE TABLE "seat" (
	"id" uuid PRIMARY KEY NOT NULL,
	"hall_id" uuid NOT NULL,
	"row" integer NOT NULL,
	"number" integer NOT NULL,
	"seat_type" "seat_type" NOT NULL,
	CONSTRAINT "seat_hall_row_number_key" UNIQUE("hall_id","row","number")
);
--> statement-breakpoint
CREATE TABLE "showtime" (
	"id" uuid PRIMARY KEY NOT NULL,
	"movie_id" uuid NOT NULL,
	"hall_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_showtime_id_showtime_id_fk" FOREIGN KEY ("showtime_id") REFERENCES "public"."showtime"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_seat" ADD CONSTRAINT "booking_seat_seat_id_seat_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_seat" ADD CONSTRAINT "booking_seat_booking_fk" FOREIGN KEY ("booking_id","showtime_id") REFERENCES "public"."booking"("id","showtime_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_booking_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_genre" ADD CONSTRAINT "movie_genre_movie_id_movie_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_genre" ADD CONSTRAINT "movie_genre_genre_id_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat" ADD CONSTRAINT "seat_hall_id_cinema_hall_id_fk" FOREIGN KEY ("hall_id") REFERENCES "public"."cinema_hall"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showtime" ADD CONSTRAINT "showtime_movie_id_movie_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showtime" ADD CONSTRAINT "showtime_hall_id_cinema_hall_id_fk" FOREIGN KEY ("hall_id") REFERENCES "public"."cinema_hall"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_user_id_created_at_idx" ON "booking" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_seat_booking_id_idx" ON "booking_seat" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "showtime_movie_id_starts_at_idx" ON "showtime" USING btree ("movie_id","starts_at");