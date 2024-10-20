"use client"

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Music, Play, SkipForward, Share2 } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import { spotifyApi } from '@/lib/spotify';
import { supabase } from '@/lib/supabase';

const GENRES = ['Pop', 'Rock', 'Hip Hop', 'Electronic', 'Country', 'Jazz', 'Classical'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export default function Game() {
  const { data: session } = useSession();
  const [genre, setGenre] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [snippetDuration, setSnippetDuration] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);

  useEffect(() => {
    if (session?.accessToken) {
      spotifyApi.setAccessToken(session.accessToken);
    }
  }, [session]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    let WaveSurfer;
    if (typeof window !== 'undefined') {
      import('wavesurfer.js').then((WaveSurferModule) => {
        WaveSurfer = WaveSurferModule.default;
        if (waveformRef.current && !wavesurfer.current) {
          wavesurfer.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: 'violet',
            progressColor: 'purple',
            cursorColor: 'navy',
            barWidth: 3,
            barRadius: 3,
            responsive: true,
            height: 80,
          });
        }
      });
    }

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, []);

  const fetchLeaderboard = async () => {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching leaderboard:', error);
    } else {
      setLeaderboard(data);
    }
  };

  const startGame = async () => {
    if (!session) {
      signIn('spotify');
      return;
    }
    setIsPlaying(true);
    await loadNextSong();
  };

  const loadNextSong = async () => {
    try {
      const data = await spotifyApi.getRecommendations({
        seed_genres: [genre.toLowerCase()],
        limit: 1,
      });

      if (data.body.tracks.length > 0) {
        const track = data.body.tracks[0];
        setCurrentSong({ 
          id: track.id,
          title: track.name, 
          artist: track.artists[0].name,
          previewUrl: track.preview_url,
        });
        setGuess('');

        if (wavesurfer.current) {
          wavesurfer.current.load(track.preview_url);
          wavesurfer.current.on('ready', () => {
            wavesurfer.current.play();
            setTimeout(() => {
              wavesurfer.current.pause();
            }, snippetDuration * 1000);
          });
        }
      }
    } catch (error) {
      console.error('Error loading song:', error);
      toast.error('Failed to load song. Please try again.');
    }
  };

  const handleGuess = async () => {
    if (guess.toLowerCase() === currentSong.title.toLowerCase()) {
      const newScore = score + 1;
      setScore(newScore);
      toast.success("Correct!", {
        description: `The song was "${currentSong.title}" by ${currentSong.artist}`,
      });

      // Update leaderboard
      if (session?.user?.email) {
        const { data, error } = await supabase
          .from('leaderboard')
          .upsert({ email: session.user.email, score: newScore }, { onConflict: 'email' });

        if (error) {
          console.error('Error updating leaderboard:', error);
        } else {
          fetchLeaderboard();
        }
      }

      await loadNextSong();
    } else {
      toast.error("Incorrect", {
        description: "Try again or increase the snippet duration",
      });
    }
  };

  const handlePass = async () => {
    toast.info("Passed", {
      description: `The song was "${currentSong.title}" by ${currentSong.artist}`,
    });
    await loadNextSong();
  };

  const handleShare = () => {
    const shareText = `I scored ${score} points in Choon Music Guessing Game! Can you beat my score? Play now at ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({
        title: 'Choon Music Guessing Game',
        text: shareText,
        url: window.location.origin,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {!isPlaying ? (
        <div className="space-y-4">
          <Select onValueChange={setGenre}>
            <SelectTrigger>
              <SelectValue placeholder="Select a genre" />
            </SelectTrigger>
            <SelectContent>
              {GENRES.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger>
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
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
            <span>Score: {score}</span>
            <span>Genre: {genre || 'Mixed'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Music className="h-8 w-8" />
            <Slider
              value={[snippetDuration]}
              onValueChange={(value) => setSnippetDuration(value[0])}
              max={4}
              step={0.5}
              className="w-full"
            />
            <span>{snippetDuration}s</span>
          </div>
          <div ref={waveformRef} />
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
        </div>
      )}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
        <ul>
          {leaderboard.map((entry, index) => (
            <li key={entry.id} className="flex justify-between items-center py-2 border-b">
              <span>{index + 1}. {entry.email}</span>
              <span>{entry.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}