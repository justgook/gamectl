#!/usr/bin/env python3
"""Write the deterministic development pack described by ../CONTRACT.md.

This is intentionally a fixture generator, not the public Director compiler or
Project export pipeline. The default fixture's exit rule requires restored power.
"""
from pathlib import Path
import struct
import sys

U32 = lambda value: struct.pack("<I", value & 0xFFFFFFFF)
I32 = lambda value: struct.pack("<i", value)
RANGE = lambda offset=0, count=0: U32(offset) + U32(count)


def string(value: str) -> bytes:
    encoded = value.encode("utf-8")
    return U32(len(encoded)) + encoded


def entity(entity_id: int, tags=()) -> bytes:
    return (
        U32(entity_id)
        + U32(len(tags)) + b"".join(U32(tag) for tag in tags)
        + U32(0)  # stats
        + U32(0)  # links
        + b"\0"   # available
    )


def matcher(entity_id: int, query_offset=0, query_count=0) -> bytes:
    return U32(0) + U32(entity_id) + RANGE(query_offset, query_count)


def query_has_tag(word_id: int) -> bytes:
    # Query plus inactive Stat_Value and Link_Value fields.
    return (
        U32(0) + U32(word_id) + U32(0)
        + U32(0) + U32(0) + U32(0) + I32(0)
        + U32(0) + U32(0) + U32(0) + U32(0)
        + U32(0)
    )


def change(entity_id: int, kind: int, word_id=0) -> bytes:
    # Entity target, then change and inactive Link_Target fields.
    return (
        U32(0) + U32(entity_id) + U32(0)
        + U32(kind) + U32(word_id) + I32(0)
        + U32(0) + U32(0) + U32(0)
    )


def rule(rule_id: int, trigger_matcher: int, condition_offset: int,
         condition_count: int, change_offset: int, change_count: int) -> bytes:
    return (
        U32(rule_id)
        + U32(1) + U32(0) + U32(trigger_matcher)
        + RANGE(condition_offset, condition_count)
        + RANGE(change_offset, change_count)
        + I32(10)
    )


def array(values) -> bytes:
    values = tuple(values)
    return U32(len(values)) + b"".join(values)


def build_director() -> bytes:
    # Entities: PLAYER, POWER_SWITCH, ACCESS_KEY, EXIT.
    # Words: powered, carrying_key, locked.
    entities = array((entity(0), entity(1), entity(2), entity(3, (2,))))
    rules = array((
        rule(0, 0, 0, 0, 0, 1),
        rule(1, 1, 0, 0, 1, 2),
        rule(2, 2, 3, 1, 3, 1),
    ))
    matchers = array((
        matcher(1), matcher(2), matcher(3),
        matcher(0, 0, 1), matcher(0, 1, 1),
    ))
    queries = array((query_has_tag(0), query_has_tag(1)))
    # Change kinds: Add_Tag=0, Remove_Tag=1, Remove_Entity=7.
    changes = array((
        change(0, 0, 0),
        change(0, 0, 1),
        change(2, 7),
        change(3, 1, 2),
    ))
    return entities + rules + matchers + queries + changes


def build_bindings() -> bytes:
    values = (
        (0, "PLAYER", 0),
        (0, "POWER_SWITCH", 1),
        (0, "ACCESS_KEY", 2),
        (0, "EXIT", 3),
        (1, "powered", 0),
        (1, "carrying_key", 1),
        (1, "locked", 2),
    )
    return U32(len(values)) + b"".join(
        U32(kind) + string(name) + U32(value) for kind, name, value in values
    )


def build_pack() -> bytes:
    slots = (build_director(), build_bindings())
    header_size = 8 + len(slots) * 8
    offset = header_size
    table = bytearray()
    for slot in slots:
        table.extend(U32(offset))
        table.extend(U32(len(slot)))
        offset += len(slot)
    return b"RSPK" + struct.pack("<HH", 1, len(slots)) + table + b"".join(slots)


def main() -> None:
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("station.rspk")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(build_pack())


if __name__ == "__main__":
    main()
