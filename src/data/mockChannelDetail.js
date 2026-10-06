import { chResponse, uploadsResponse, videoResponse } from '../../reference/mock.js'
import { buildChannelDetail } from './channelDetail.js'

export function buildMockChannelDetail({
  channelResponse = chResponse,
  uploads = uploadsResponse,
  videoDetails = videoResponse,
} = {}) {
  const playlistItems = uploads.items ?? []
  const normalizedVideoDetails = playlistItems.flatMap((upload, index) => {
    const details = videoDetails[index]?.items?.[0]
    const videoId = upload.contentDetails?.videoId ?? upload.snippet?.resourceId?.videoId

    return details ? [{ ...details, id: details.id ?? videoId }] : []
  })

  return buildChannelDetail({
    channel: channelResponse.items?.[0],
    playlistItems,
    videoDetails: normalizedVideoDetails,
  })
}

export const mockChannelDetail = buildMockChannelDetail()
