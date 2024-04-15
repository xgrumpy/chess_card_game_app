/* DDL for our database */

create table users
(
    uid      TEXT not null
        constraint users_pk
            primary key,
    pwd      TEXT not null,
    birthday TEXT not null,
    gender   TEXT not null,
    email    TEXT not null,
    salt     TEXT not null,
    rating   INTEGER default 300 not null
);


create table activity_log
(
    category      TEXT not null,
    uid           TEXT not null,
    event         TEXT not null,
    data          TEXT not null,
    timestamp_eph REAL not null
);

create table sessions
(
    uid           TEXT not null
        constraint sessions_users_uid_fk
            references users
            on update cascade on delete cascade,
    session       TEXT not null
        constraint primary_key_session
            primary key,
    timestamp_eph REAL not null
);

/* The views are currently unused but may help us down the road */

CREATE VIEW timed_sessions as
select uid, session, (round(unixepoch('now', 'subsec')) - round(sessions.timestamp_eph)) as delta
from sessions;

CREATE VIEW user_activity as
select uid, session, cast(min(delta) as REAL) as delta
from timed_sessions
group by uid
order by delta;

CREATE VIEW dated_activity_log as
select datetime(timestamp_eph, 'unixepoch', 'subsec') as timestamp, category, uid, event, data 
from activity_log;