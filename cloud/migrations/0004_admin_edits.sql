CREATE TRIGGER stats_edit AFTER UPDATE OF public_json ON matches
WHEN NEW.deleted=0 AND NEW.public_json IS NOT OLD.public_json BEGIN
  UPDATE stats_state SET revision=revision+1 WHERE id=1;
END;
