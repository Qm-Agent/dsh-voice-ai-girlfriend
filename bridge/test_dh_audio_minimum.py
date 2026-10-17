import unittest
import numpy as np
from voice_bridge import _dh_audio_minimum


class MinimumAudioTests(unittest.TestCase):
    def test_short_clip_keeps_speech_and_adds_only_trailing_silence(self):
        samples = np.arange(8000, dtype=np.int16)
        padded = _dh_audio_minimum(samples)
        self.assertEqual(len(padded), 16800)
        self.assertEqual(padded.dtype, samples.dtype)
        np.testing.assert_array_equal(padded[:8000], samples)
        self.assertFalse(padded[8000:].any())

    def test_normal_clip_is_not_copied_or_extended(self):
        samples = np.ones(32000, dtype=np.int16)
        self.assertIs(_dh_audio_minimum(samples), samples)


if __name__ == '__main__':
    unittest.main()
