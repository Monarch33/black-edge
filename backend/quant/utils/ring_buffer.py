"""
Ring Buffer - O(1) Circular Time-Series Storage
Ultra-fast pre-allocated numpy-based circular buffer for streaming data.
No Python lists, no deque - pure numpy for zero-copy operations.
"""

from __future__ import annotations

import numpy as np


class RingBuffer:
    """
    High-performance circular buffer with O(1) append and aggregations.

    Pre-allocates a fixed-size numpy array and uses modulo arithmetic
    for circular indexing. Optimized for time-series feature engineering.

    Example:
        >>> buf = RingBuffer(capacity=1000, dtype=np.float64)
        >>> buf.append(0.62)
        >>> buf.extend(np.array([0.63, 0.64, 0.65]))
        >>> recent = buf.tail(10)
        >>> avg = buf.mean()
    """

    __slots__ = ('_buffer', '_capacity', '_head', '_count', '_dtype')

    def __init__(self, capacity: int, dtype=np.float64):
        """
        Initialize a ring buffer with fixed capacity.

        Args:
            capacity: Maximum number of elements to store
            dtype: Numpy data type (default: float64)
        """
        if capacity <= 0:
            raise ValueError(f"Capacity must be positive, got {capacity}")

        self._capacity = capacity
        self._buffer = np.empty(capacity, dtype=dtype)
        self._head = 0      # Index where next write occurs
        self._count = 0     # Current number of valid elements
        self._dtype = dtype

    def append(self, value: float) -> None:
        """
        Append a single value in O(1) time.
        Overwrites oldest value if buffer is full.

        Args:
            value: Scalar value to append
        """
        self._buffer[self._head] = value
        self._head = (self._head + 1) % self._capacity
        if self._count < self._capacity:
            self._count += 1

    def extend(self, values: np.ndarray) -> None:
        """
        Bulk append multiple values efficiently.

        Args:
            values: 1D numpy array of values to append
        """
        n = len(values)
        if n == 0:
            return

        if n >= self._capacity:
            # If incoming data exceeds capacity, just keep the tail
            self._buffer[:] = values[-self._capacity:]
            self._head = 0
            self._count = self._capacity
            return

        # Split into two parts if wrapping around
        space_to_end = self._capacity - self._head
        if n <= space_to_end:
            # Fits without wrapping
            self._buffer[self._head:self._head + n] = values
            self._head = (self._head + n) % self._capacity
        else:
            # Needs to wrap around
            self._buffer[self._head:] = values[:space_to_end]
            remainder = n - space_to_end
            self._buffer[:remainder] = values[space_to_end:]
            self._head = remainder

        self._count = min(self._count + n, self._capacity)

    def tail(self, n: int) -> np.ndarray:
        """
        Return the last n values in chronological order.

        Args:
            n: Number of recent values to retrieve

        Returns:
            1D numpy array of length min(n, count)
        """
        if n <= 0:
            return np.array([], dtype=self._dtype)

        n = min(n, self._count)
        if n == 0:
            return np.array([], dtype=self._dtype)

        if not self.is_full:
            # Buffer not full yet, data is contiguous from start
            return self._buffer[:self._count][-n:].copy()

        # Buffer is full, need to handle wrap-around
        start = (self._head - n) % self._capacity
        if start < self._head:
            # Data is contiguous
            return self._buffer[start:self._head].copy()
        else:
            # Data wraps around: from start to end, then from 0 to head
            return np.concatenate([
                self._buffer[start:],
                self._buffer[:self._head]
            ])

    def mean(self) -> float:
        """
        Compute mean of all valid values in O(n).

        Returns:
            Mean value, or NaN if buffer is empty
        """
        if self._count == 0:
            return np.nan
        return np.mean(self._buffer[:self._count] if not self.is_full
                      else self._buffer)

    def std(self) -> float:
        """
        Compute standard deviation of all valid values.

        Returns:
            Standard deviation, or NaN if buffer is empty
        """
        if self._count == 0:
            return np.nan
        return np.std(self._buffer[:self._count] if not self.is_full
                     else self._buffer)

    def last(self) -> float:
        """
        Get the most recently added value in O(1).

        Returns:
            Last value, or NaN if buffer is empty
        """
        if self._count == 0:
            return np.nan
        return self._buffer[(self._head - 1) % self._capacity]

    def first(self) -> float:
        """
        Get the oldest value in the buffer in O(1).

        Returns:
            First value, or NaN if buffer is empty
        """
        if self._count == 0:
            return np.nan
        if not self.is_full:
            return self._buffer[0]
        return self._buffer[self._head]

    @property
    def count(self) -> int:
        """Current number of valid elements."""
        return self._count

    @property
    def capacity(self) -> int:
        """Maximum capacity of the buffer."""
        return self._capacity

    @property
    def is_full(self) -> bool:
        """Whether the buffer has reached capacity."""
        return self._count == self._capacity

    def __len__(self) -> int:
        """Return current count for len() support."""
        return self._count

    def __repr__(self) -> str:
        return (f"RingBuffer(capacity={self._capacity}, count={self._count}, "
                f"is_full={self.is_full}, dtype={self._dtype})")
