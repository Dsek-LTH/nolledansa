import "server-only";

import { PoolClient } from "pg";
import { query, queryOne, withTransaction } from "@/lib/db";
import {
  Dance,
  DanceEditRequest,
  DanceEditRequestSegment,
  DanceSegment,
  SectionChant,
  TrendingDance,
} from "@/lib/types";

type DanceRow = Omit<Dance, "dance_clicks">;
type DanceSegmentRow = DanceSegment;
type DanceEditRequestRow = DanceEditRequest;
type DanceEditRequestSegmentRow = DanceEditRequestSegment;
type SectionChantRow = SectionChant;

function mapDance(row: DanceRow): Dance {
  return row;
}

function mapSegment(row: DanceSegmentRow): DanceSegment {
  return row;
}

export async function getApprovedSectionChants() {
  const rows = await query<SectionChantRow>(
    `select * from section_chants
     where status = 'approved'
     order by section asc, name asc`
  );
  return rows as SectionChant[];
}

export async function insertSectionChant(params: {
  section: string;
  name: string;
  melody: string;
  lyrics: string;
}) {
  await query(
    `insert into section_chants (id, section, name, melody, lyrics, status)
     values ($1, $2, $3, $4, $5, 'pending')`,
    [crypto.randomUUID(), params.section, params.name, params.melody, params.lyrics]
  );
}

export async function getTrendingDances() {
  const rows = await query<TrendingDance>(
    `with counts as (
      select dance_id, count(*)::int as view_count
      from dance_clicks
      where created_at >= now() - interval '7 days'
      group by dance_id
    )
    select d.*, c.view_count
    from counts c
    join dances d on d.id = c.dance_id
    where d.status = 'approved'
    order by c.view_count desc
    limit 10`
  );

  return rows.map((row) => ({ ...mapDance(row), view_count: row.view_count }));
}

export async function searchApprovedDances(term: string) {
  const q = `%${term}%`;
  const rows = await query<DanceRow>(
    `select * from dances
     where status = 'approved'
       and (
         title ilike $1 or
         section ilike $1 or
         year ilike $1 or
         song_title ilike $1 or
         coalesce(dancer_names, '') ilike $1 or
         coalesce(artist, '') ilike $1
       )
     order by created_at desc
     limit 30`,
    [q]
  );
  return rows.map(mapDance);
}

export async function getRandomApprovedDances(limit: number) {
  const rows = await query<DanceRow>(
    `select * from dances
     where status = 'approved'
     order by random()
     limit $1`,
    [limit]
  );
  return rows.map(mapDance);
}

export async function getCurrentYearDances(limit: number) {
  const now = new Date();
  const fullYear = String(now.getFullYear());
  const shortYear = fullYear.slice(-2);

  const rows = await query<DanceRow>(
    `select * from dances
     where status = 'approved'
       and year = any($1::text[])
     order by created_at desc
     limit $2`,
    [[shortYear, fullYear], limit]
  );
  return rows.map(mapDance);
}

export async function getApprovedDancesByFilters(filters: {
  sections: string[];
  years: string[];
  organizations: string[];
  sort: "section" | "newest" | "oldest";
}) {
  const conditions = [`status = 'approved'`];
  const params: unknown[] = [];

  if (filters.sections.length > 0) {
    params.push(filters.sections);
    conditions.push(`section = any($${params.length}::text[])`);
  }
  if (filters.years.length > 0) {
    params.push(filters.years);
    conditions.push(`year = any($${params.length}::text[])`);
  }
  if (filters.organizations.length > 0) {
    params.push(filters.organizations);
    conditions.push(`organization = any($${params.length}::text[])`);
  }

  let orderBy = "year desc, section asc, created_at desc";
  if (filters.sort === "section") {
    orderBy = "section asc, year desc, created_at desc";
  } else if (filters.sort === "oldest") {
    orderBy = "year asc, section asc, created_at desc";
  }

  const rows = await query<DanceRow>(
    `select * from dances
     where ${conditions.join(" and ")}
     order by ${orderBy}`
    ,
    params
  );

  return rows.map(mapDance);
}

export async function getAvailableApprovedYears() {
  const rows = await query<{ year: string }>(
    `select distinct year from dances
     where status = 'approved'
     order by year desc`
  );
  return rows.map((row) => row.year).filter(Boolean);
}

export async function getDanceMetadata(id: string) {
  return queryOne<{ title: string; section: string; year: string }>(
    `select title, section, year
     from dances
     where id = $1 and status = 'approved'`,
    [id]
  );
}

export async function getApprovedDanceById(id: string) {
  const row = await queryOne<DanceRow>(
    `select * from dances
     where id = $1 and status = 'approved'`,
    [id]
  );
  return row ? mapDance(row) : null;
}

export async function getDanceById(id: string) {
  const row = await queryOne<DanceRow>(
    `select * from dances where id = $1`,
    [id]
  );
  return row ? mapDance(row) : null;
}

export async function getDanceSegments(danceId: string) {
  const rows = await query<DanceSegmentRow>(
    `select * from dance_segments
     where dance_id = $1
     order by sort_order asc`,
    [danceId]
  );
  return rows.map(mapSegment);
}

export async function trackDanceView(params: {
  danceId: string;
  sessionId?: string | null;
  userId?: string | null;
}) {
  if (params.sessionId) {
    const existing = await queryOne<{ id: string }>(
      `select id from dance_clicks
       where dance_id = $1
         and session_id = $2
         and created_at >= now() - interval '60 seconds'
       limit 1`,
      [params.danceId, params.sessionId]
    );
    if (existing) {
      return { deduped: true };
    }
  }

  await query(
    `insert into dance_clicks (id, dance_id, user_id, session_id)
     values ($1, $2, $3, $4)`,
    [crypto.randomUUID(), params.danceId, params.userId ?? null, params.sessionId ?? null]
  );

  return { deduped: false };
}

export async function createDanceWithSegments(params: {
  danceId: string;
  title: string;
  section: string;
  organization: string;
  year: string;
  songTitle: string;
  dancerNames: string;
  artist?: string | null;
  spotifyUrl?: string | null;
  videoUrl: string;
  thumbnailUrl?: string | null;
  createdBy?: string | null;
  segments: Array<{
    name: string;
    description?: string | null;
    startTime: number;
    endTime: number;
    sortOrder: number;
  }>;
}) {
  await withTransaction(async (client) => {
    await client.query(
      `insert into dances (
        id, title, section, organization, year, song_title, dancer_names, artist,
        spotify_url, video_url, thumbnail_url, created_by, status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')`,
      [
        params.danceId,
        params.title,
        params.section,
        params.organization,
        params.year,
        params.songTitle,
        params.dancerNames,
        params.artist ?? null,
        params.spotifyUrl ?? null,
        params.videoUrl,
        params.thumbnailUrl ?? null,
        params.createdBy ?? null,
      ]
    );

    for (const segment of params.segments) {
      await client.query(
        `insert into dance_segments
          (id, dance_id, name, description, start_time, end_time, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          crypto.randomUUID(),
          params.danceId,
          segment.name,
          segment.description ?? null,
          segment.startTime,
          segment.endTime,
          segment.sortOrder,
        ]
      );
    }
  });
}

export async function createDanceEditRequest(params: {
  requestId: string;
  danceId: string;
  requestType: "edit" | "delete" | "hide";
  title: string;
  section: string;
  organization: string;
  year: string;
  songTitle: string;
  dancerNames: string;
  artist?: string | null;
  spotifyUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  requesterNote?: string | null;
  hideUntil?: string | null;
  hideIndefinitely?: boolean | null;
  segments: Array<{
    name: string;
    description?: string | null;
    startTime: number;
    endTime: number;
    sortOrder: number;
  }>;
}) {
  await withTransaction(async (client) => {
    await client.query(
      `insert into dance_edit_requests (
        id, dance_id, request_type, title, section, organization, year, song_title,
        dancer_names, artist, spotify_url, video_url, thumbnail_url, requester_note,
        hide_until, hide_indefinitely, status
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending'
      )`,
      [
        params.requestId,
        params.danceId,
        params.requestType,
        params.title,
        params.section,
        params.organization,
        params.year,
        params.songTitle,
        params.dancerNames,
        params.artist ?? null,
        params.spotifyUrl ?? null,
        params.videoUrl ?? null,
        params.thumbnailUrl ?? null,
        params.requesterNote ?? null,
        params.hideUntil ?? null,
        params.hideIndefinitely ?? null,
      ]
    );

    for (const segment of params.segments) {
      await client.query(
        `insert into dance_edit_request_segments
          (id, request_id, name, description, start_time, end_time, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          crypto.randomUUID(),
          params.requestId,
          segment.name,
          segment.description ?? null,
          segment.startTime,
          segment.endTime,
          segment.sortOrder,
        ]
      );
    }
  });
}

export async function getAdminOverviewData() {
  const [pending, pendingEdits, pendingChants, hiddenDances] = await Promise.all([
    query<DanceRow>(
      `select * from dances where status = 'pending' order by created_at asc`
    ),
    query<DanceEditRequestRow>(
      `select * from dance_edit_requests where status = 'pending' order by created_at asc`
    ),
    query<SectionChantRow>(
      `select * from section_chants where status = 'pending' order by created_at asc`
    ),
    query<DanceRow>(
      `select * from dances where status = 'hidden' order by hidden_at desc nulls last`
    ),
  ]);

  return {
    dances: pending.map(mapDance),
    editRequests: pendingEdits as DanceEditRequest[],
    sectionChants: pendingChants as SectionChant[],
    hiddenDances: hiddenDances.map(mapDance),
  };
}

export async function getDancesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await query<{ id: string; title: string; section: string; year: string }>(
    `select id, title, section, year
     from dances
     where id = any($1::uuid[])`,
    [ids]
  );
  return rows;
}

export async function getEditRequestById(id: string) {
  const request = await queryOne<DanceEditRequestRow>(
    `select * from dance_edit_requests where id = $1`,
    [id]
  );
  if (!request) return null;
  const segments = await query<DanceEditRequestSegmentRow>(
    `select * from dance_edit_request_segments
     where request_id = $1
     order by sort_order asc`,
    [id]
  );
  return { request: request as DanceEditRequest, segments: segments as DanceEditRequestSegment[] };
}

export async function updateDanceStatus(danceId: string, status: "approved" | "rejected") {
  await query(`update dances set status = $2 where id = $1`, [danceId, status]);
}

export async function restoreHiddenDanceRecord(danceId: string) {
  await query(
    `update dances
     set status = 'approved', hidden_until = null, hidden_note = null, hidden_at = null
     where id = $1`,
    [danceId]
  );
}

export async function updateSectionChantStatus(chantId: string, status: "approved" | "rejected") {
  await query(`update section_chants set status = $2 where id = $1`, [chantId, status]);
}

async function markRequest(client: PoolClient, requestId: string, status: "approved" | "rejected") {
  await client.query(
    `update dance_edit_requests
     set status = $2, resolved_at = now()
     where id = $1`,
    [requestId, status]
  );
}

export async function resolveEditRequest(requestId: string, approved: boolean) {
  if (!approved) {
    await query(
      `update dance_edit_requests
       set status = 'rejected', resolved_at = now()
       where id = $1`,
      [requestId]
    );
    return;
  }

  await withTransaction(async (client) => {
    const requestResult = await client.query<DanceEditRequestRow>(
      `select * from dance_edit_requests where id = $1`,
      [requestId]
    );
    const request = requestResult.rows[0];
    if (!request) {
      throw new Error("Kunde inte hitta ändringsförslaget.");
    }

    const requestSegmentsResult = await client.query<DanceEditRequestSegmentRow>(
      `select * from dance_edit_request_segments
       where request_id = $1
       order by sort_order asc`,
      [requestId]
    );
    const requestSegments = requestSegmentsResult.rows;
    const requestType = request.request_type ?? "edit";

    if (requestType === "delete") {
      await client.query(`delete from dance_segments where dance_id = $1`, [request.dance_id]);
      await client.query(`update dances set status = 'rejected' where id = $1`, [request.dance_id]);
      await markRequest(client, requestId, "approved");
      return;
    }

    if (requestType === "hide") {
      await client.query(
        `update dances
         set status = 'hidden',
             hidden_until = $2,
             hidden_note = $3,
             hidden_at = now()
         where id = $1`,
        [request.dance_id, request.hide_indefinitely ? null : request.hide_until, request.requester_note]
      );
      await markRequest(client, requestId, "approved");
      return;
    }

    await client.query(
      `update dances set
         title = $2,
         section = $3,
         organization = $4,
         year = $5,
         song_title = $6,
         dancer_names = $7,
         artist = $8,
         spotify_url = $9,
         thumbnail_url = $10,
         video_url = $11
       where id = $1`,
      [
        request.dance_id,
        request.title,
        request.section,
        request.organization ?? "Nollningen",
        request.year,
        request.song_title,
        request.dancer_names ?? "",
        request.artist,
        request.spotify_url,
        request.thumbnail_url,
        request.video_url,
      ]
    );

    await client.query(`delete from dance_segments where dance_id = $1`, [request.dance_id]);

    for (let i = 0; i < requestSegments.length; i++) {
      const segment = requestSegments[i];
      await client.query(
        `insert into dance_segments
          (id, dance_id, name, description, start_time, end_time, sort_order)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          crypto.randomUUID(),
          request.dance_id,
          segment.name,
          segment.description,
          segment.start_time,
          segment.end_time,
          i,
        ]
      );
    }

    await markRequest(client, requestId, "approved");
  });
}
