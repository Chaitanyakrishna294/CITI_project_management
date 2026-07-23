/**
 * Key–value editor for the free-form `metadata` JSONB carried by individuals
 * and teams (workshop brief: individual-level and team-level metadata).
 *
 * Works on an array of {key, value} rows so edits stay local and ordered;
 * convert with toPairs/fromPairs at the dialog boundary. Rows with an empty
 * key are dropped on save rather than rejected.
 */
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AddIcon, DeleteIcon } from './icons';

export default function MetadataEditor({ pairs, onChange, label = 'Metadata' }) {
  function updateRow(index, patch) {
    onChange(pairs.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        {label}
      </Typography>
      <Stack spacing={1}>
        {pairs.map((row, index) => (
          // Index keys are safe here: rows are only appended/removed in place.
          <Stack key={index} direction="row" spacing={1} alignItems="center">
            <TextField
              label="Key" size="small" value={row.key}
              onChange={(e) => updateRow(index, { key: e.target.value })}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Value" size="small" value={row.value}
              onChange={(e) => updateRow(index, { value: e.target.value })}
              sx={{ flex: 2 }}
            />
            <IconButton
              aria-label={`Remove ${row.key || 'metadata'} row`}
              onClick={() => onChange(pairs.filter((_, i) => i !== index))}
            >
              <DeleteIcon size={18} />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button
        size="small"
        startIcon={<AddIcon size={16} />}
        onClick={() => onChange([...pairs, { key: '', value: '' }])}
        sx={{ mt: 1 }}
      >
        Add field
      </Button>
    </Box>
  );
}
