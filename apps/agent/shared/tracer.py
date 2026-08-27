"""SSE event bus — faithful copy of 06-course-pattern-lab/shared/tracer.py."""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass, field


@dataclass
class RunTracer:
    queue: asyncio.Queue = field(default_factory=asyncio.Queue)
    started_at: float = field(default_factory=time.time)
    events: list[dict] = field(default_factory=list)

    async def emit(self, event_type: str, payload: dict | None = None) -> None:
        item = {
            "t": round(time.time() - self.started_at, 4),
            "type": event_type,
            "payload": payload or {},
        }
        self.events.append(item)
        await self.queue.put(item)

    async def emit_done(self, final: dict) -> None:
        await self.emit("done", final)
        await self.queue.put(None)

    async def emit_error(self, error: dict) -> None:
        await self.emit("error", error)
        await self.queue.put(None)

    async def sse_generator(self):
        while True:
            item = await self.queue.get()
            if item is None:
                return
            yield f"data: {json.dumps(item, default=str, ensure_ascii=False)}\n\n"
