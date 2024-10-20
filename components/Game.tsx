"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Music, Play, SkipForward, Share2 } from "lucide-react";
import { useSession, signIn } from "next-auth/react";
import { spotifyApi } from "@/lib/spotify";
import { supabase } from "@/lib/supabase";
/* import { WaveSurfer } from "wavesurfer.js";
 */ import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import stringSimilarity from "string-similarity";

const GENRES = [
  "Pop",
  "Rock",
  "Hip Hop",
  "Electronic",
  "Country",
  "Jazz",
  "Classical",
];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

const initializeSpotifyPlayer = (token) => {
  const script = document.createElement("script");
  script.src = "https://sdk.scdn.co/spotify-player.js";
  document.body.appendChild(script);

  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: "Web Playback SDK",
      getOAuthToken: (cb) => {
        cb(token);
      },
    });

    // Error handling
    player.addListener("initialization_error", ({ message }) => {
      console.error(message);
    });
    player.addListener("authentication_error", ({ message }) => {
      console.error(message);
    });
    player.addListener("account_error", ({ message }) => {
      console.error(message);
    });
    player.addListener("playback_error", ({ message }) => {
      console.error(message);
    });

    // Playback status updates
    player.addListener("player_state_changed", (state) => {
      console.log(state);
    });

    // Ready
    player.addListener("ready", ({ device_id }) => {
      console.log("Ready with Device ID", device_id);
      // You can now use the device_id to play tracks
    });

    // Connect to the player!
    player.connect();
  };
};

const SIMILARITY_THRESHOLD = 0.85; // Correct guess threshold
const CLOSE_THRESHOLD = 0.5; // Close guess threshold

export default function Game() {
  const { data: session } = useSession();
  const [genre, setGenre] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [snippetDuration, setSnippetDuration] = useState(30); // Set initial minimum duration
  const [isGamePlaying, setIsGamePlaying] = useState(false); // Renamed from isPlaying
  const [isAudioPlaying, setIsAudioPlaying] = useState(false); // New state for audio playback
  const [currentSong, setCurrentSong] = useState(null);
  const [guess, setGuess] = useState("");
  const [currentScore, setCurrentScore] = useState(0); // State for current score accumulation
  const [leaderboard, setLeaderboard] = useState([]);
  const [userName, setUserName] = useState(""); // State for user's name
  const [userEmail, setUserEmail] = useState(""); // State for user's email
  const playerRef = useRef<AudioPlayer>(null);
  const [nextSongLoading, setNextSongLoading] = useState(false);

  // New States for Replay Feature
  const [canReplay, setCanReplay] = useState(false);
  const [hasReplayed, setHasReplayed] = useState(false);
  const [scoreMultiplier, setScoreMultiplier] = useState(1); // 1 means no penalty

  useEffect(() => {
    console.log("current song", currentSong);
  }, [currentSong]);

  useEffect(() => {
    console.log("is audio playing", isAudioPlaying);
  }, [isAudioPlaying]);

  useEffect(() => {
    if (session?.accessToken) {
      spotifyApi.setAccessToken(session.accessToken);
      initializeSpotifyPlayer(session.accessToken);
    }
  }, [session]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("*")
      .order("score", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching leaderboard:", error);
    } else {
      setLeaderboard(data);
    }
  };

  const startGame = async () => {
    if (!session) {
      signIn("spotify");
      return;
    }
    setIsGamePlaying(true);
    await loadNextSong();
  };

  const loadNextSong = async () => {
    setNextSongLoading(true);
    try {
      let minPopularity;
      switch (difficulty) {
        case "Easy":
          minPopularity = 70; // More popular songs
          break;
        case "Medium":
          minPopularity = 50;
          break;
        case "Hard":
          minPopularity = 30; // Less popular songs
          break;
        default:
          minPopularity = 50;
      }

      const data = await spotifyApi.getRecommendations({
        seed_genres: [genre.toLowerCase()],
        limit: 10,
        min_popularity: minPopularity, // Add this line
      });

      const tracksWithPreview = data.body.tracks.filter(
        (track) => track.preview_url
      );

      if (tracksWithPreview.length > 0) {
        const track = tracksWithPreview[0];
        setCurrentSong({
          id: track.id,
          title: track.name,
          artist: track.artists[0].name,
          previewUrl: track.preview_url,
        });
        setGuess("");
        setIsAudioPlaying(true); // Start audio playback

        // Reset Replay States for the New Song
        setCanReplay(false);
        setHasReplayed(false);
        setScoreMultiplier(1);
      } else {
        toast.error("No tracks with previews available. Please try again.");
      }
    } catch (error) {
      console.error("Error loading song:", error);
      toast.error("Failed to load song. Please try again.");
    } finally {
      setNextSongLoading(false);
    }
  };

  const handleGuess = async () => {
    if (!currentSong) return;

    // Clean the title by removing text within parentheses and common suffixes
    const cleanTitle = currentSong.title
      .replace(/\([^)]*\)/g, "") // Remove text within parentheses
      .replace(/- Remaster(ed)?/i, "") // Remove "Remaster" or "Remastered"
      .replace(/- Live/i, "") // Remove "Live"
      .replace(/- Acoustic/i, "") // Remove "Acoustic"
      .replace(/- Radio Edit/i, "") // Remove "Radio Edit"
      .replace(/- Extended Mix/i, "") // Remove "Extended Mix"
      .replace(/- Instrumental/i, "") // Remove "Instrumental"
      .replace(/- Remix/i, "") // Remove "Remix"
      .replace(/- Mix/i, "") // Remove "Mix"
      .replace(/- Edit/i, "") // Remove "Edit"
      .replace(/- Version/i, "") // Remove "Version"
      .replace(/- Dub/i, "") // Remove "Dub"
      .replace(/feat\.?/i, "") // Remove "feat." or "featuring"
      .replace(/ft\.?/i, "") // Remove "ft."
      .replace(/\d{4} Version/i, "") // Remove year version
      .replace(/- English Version/i, "") // Remove "English Version"
      .replace(/- Spanish Version/i, "") // Remove "Spanish Version"
      .trim();

    const similarity = stringSimilarity.compareTwoStrings(
      guess.toLowerCase(),
      cleanTitle.toLowerCase()
    );

    if (similarity >= SIMILARITY_THRESHOLD) {
      // Calculate score based on snippet duration and scoreMultiplier
      const durationFactor = 30 / snippetDuration; // More points for shorter durations
      const newScore =
        currentScore + Math.round(durationFactor * scoreMultiplier);
      setCurrentScore(newScore);

      toast.success("Correct!", {
        description: `The song was "${currentSong.title}" by ${currentSong.artist}`,
      });

      console.log("email", userEmail);
      // Check and update leaderboard
      if (userEmail) {
        const { data: existingEntry, error: fetchError } = await supabase
          .from("leaderboard")
          .select("score")
          .eq("email", userEmail)
          .single();

        console.log("existing entry", existingEntry);

        if (!existingEntry || newScore > existingEntry.score) {
          console.log("new score is higher than existing score");
          const { data, error } = await supabase
            .from("leaderboard")
            .upsert(
              { email: userEmail, name: userName, score: newScore },
              { onConflict: "email" }
            );

          if (error) {
            console.error("Error updating leaderboard:", error);
          } else {
            fetchLeaderboard();
          }
        }
      }

      await loadNextSong();
    } else {
      // Reset score on incorrect guess
      setCurrentScore(0);
      toast.error("Incorrect", {
        description: "Try again or increase the snippet duration",
      });
    }
  };

  const handlePass = async () => {
    // Reset score on pass
    setCurrentScore(0);
    toast.info("Passed", {
      description: `The song was "${currentSong.title}" by ${currentSong.artist}`,
    });
    await loadNextSong();
  };

  const handleShare = () => {
    const shareText = `I scored ${currentScore} points in Choon Music Guessing Game! Can you beat my score? Play now at ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({
        title: "Choon Music Guessing Game",
        text: shareText,
        url: window.location.origin,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          shareText
        )}`,
        "_blank"
      );
    }
  };

  const handleProgress = (currentTime: number) => {
    if (currentTime >= snippetDuration && isAudioPlaying) {
      setIsAudioPlaying(false);
      if (playerRef.current) {
        playerRef.current.audio.current.pause(); // Pause the audio
        playerRef.current.audio.current.currentTime = 0; // Reset to start
      }
    }
  };

  const handleEnded = () => {
    // Only stop the audio playback without affecting the game state
    setIsAudioPlaying(false);
    setCanReplay(true); // Enable the "Play Song Again" button
    console.log("audio ended");
  };

  // Function to stop the audio
  const stopAudio = () => {
    if (playerRef.current) {
      /*  playerRef.current.audio.current.pause();
      playerRef.current.audio.current.currentTime = 0; */
      setIsAudioPlaying(false);
    }
  };

  // New Handler: Play Song Again
  const handlePlayAgain = () => {
    if (playerRef.current) {
      playerRef.current.audio.current.currentTime = 0;
      playerRef.current.audio.current.play();
      setIsAudioPlaying(true);
      setHasReplayed(true);
      setScoreMultiplier(0.5); // Reduce the score by 50%
      setCanReplay(false); // Disable the replay button after use
      toast.info("Replayed the song. Potential score reduced by 50%.", {
        duration: 3000,
      });
    }
  };

  // Example: Stop audio when the game is not playing
  /*   useEffect(() => {
    if (isGamePlaying && isAudioPlaying) {
      const timer = setTimeout(() => {
        stopAudio();
        setCanReplay(true);
        console.log("audio stopped");
      }, snippetDuration * 1000); // Convert seconds to milliseconds

      return () => clearTimeout(timer); // Clean up the timer
    }
  }, [isGamePlaying, snippetDuration, isAudioPlaying]); */

  return (
    <div className="max-w-md mx-auto">
      {!isGamePlaying ? (
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Enter your name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <Input
            type="email"
            placeholder="Enter your email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
          <Select onValueChange={setGenre}>
            <SelectTrigger>
              <SelectValue placeholder="Select a genre" />
            </SelectTrigger>
            <SelectContent>
              {GENRES.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger>
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={startGame} className="w-full">
            <Play className="mr-2 h-4 w-4" /> Start Game
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Score: {currentScore}</span>
            <span>Genre: {genre || "Mixed"}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Music className="h-8 w-8" />
            <Slider
              value={[snippetDuration]}
              onValueChange={(value) => setSnippetDuration(value[0])}
              max={30} // Set maximum to 30 seconds
              min={0.5} // Set minimum to 0.5 seconds
              step={0.5}
              className="w-full opacity-50"
              disabled={true}
            />
            <span>{snippetDuration}s</span>
          </div>
          <Input
            type="text"
            placeholder="Guess the song"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
          />
          <div className="flex space-x-2">
            <Button onClick={handleGuess} className="flex-1">
              Guess
            </Button>
            <Button onClick={handlePass} variant="outline" className="flex-1">
              <SkipForward className="mr-2 h-4 w-4" /> Pass
            </Button>
          </div>
          <Button onClick={handleShare} variant="outline" className="w-full">
            <Share2 className="mr-2 h-4 w-4" /> Share Score
          </Button>

          {/* Conditionally render the "Play Song Again" button */}
          {canReplay && (
            <Button
              onClick={handlePlayAgain}
              variant="secondary"
              className="w-full"
            >
              Play Song Again (Points Reduced)
            </Button>
          )}

          {isAudioPlaying && currentSong && currentSong.previewUrl ? (
            <AudioPlayer
              ref={playerRef}
              src={currentSong.previewUrl}
              autoPlay
              onListen={handleProgress} // Correctly pass the current playback time
              onEnded={handleEnded}
              onPlay={() => setIsAudioPlaying(true)}
              onPause={() => setIsAudioPlaying(false)}
              customAdditionalControls={[]} // Remove additional controls if not needed
              customVolumeControls={[]} // Remove volume controls if not needed
              showJumpControls={false} // Hide jump controls if not needed
            />
          ) : (
            <div></div>
          )}
        </div>
      )}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
        <ul>
          {leaderboard.map((entry, index) => (
            <li
              key={entry.id}
              className="flex justify-between items-center py-2 border-b"
            >
              <span>
                {index + 1}. {entry.name || entry.email}
              </span>
              <span>{entry.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
