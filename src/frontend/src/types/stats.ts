export type StatsOverview = {
  totalMatches: number
  finishedMatches: number
  totalGoals: number
  ownGoals: number
  penaltyGoals: number
  totalCards: number
  totalTeams: number
  totalPlayers: number
}

export type MatchStatsSummary = {
  played: number
  homeWins: number
  draws: number
  awayWins: number
  goalsHome: number
  goalsAway: number
  avgGoalsPerMatch: number | null
}

export type MatchExtremeEntry = {
  matchId: number
  matchDate: string
  homeTeamName: string
  awayTeamName: string
  homeScore: number
  awayScore: number
} | null

export type MatchExtremes = {
  biggestWin: MatchExtremeEntry
  highestScoring: MatchExtremeEntry
  lowestScoring: MatchExtremeEntry
}

export type TeamCompetitionSummaryRow = {
  teamId: number
  teamName: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
}

export type TopScorerRow = {
  playerId: number
  playerName: string
  teamId: number
  teamName: string
  goals: number
}

export type TopAssistRow = {
  playerId: number
  playerName: string
  teamId: number
  teamName: string
  assists: number
}

export type GoalsByTeamRow = { teamId: number; teamName: string; goals: number }

export type CardsByTeamRow = { teamId: number; teamName: string; yellowCards: number; redCards: number }

export type CardsByPlayerRow = {
  playerId: number
  playerName: string
  teamId: number
  teamName: string
  yellowCards: number
  redCards: number
}

export type MatchesByStatusRow = { status: string; total: number }

export type GoalsBySeasonRow = { seasonId: number; seasonLabel: string; goals: number }
