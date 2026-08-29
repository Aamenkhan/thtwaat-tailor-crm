import { Router, Request, Response, NextFunction } from 'express';
import { parseVoiceMeasurementText } from './ai.service';
import { authenticateJWT } from '../../middleware/auth';

const router = Router();

router.use(authenticateJWT);

// Voice Measurement Text to JSON Parser
router.post('/parse-measurements', (req: Request, res: Response) => {
  const { speechText } = req.body;
  if (!speechText) {
    return res.status(400).json({ error: 'Speech text is required' });
  }

  const extracted = parseVoiceMeasurementText(speechText);
  return res.json({
    originalText: speechText,
    extracted
  });
});

export const aiRoutes = router;
