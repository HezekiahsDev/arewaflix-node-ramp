export const getSample = (req, res, next) => {
  try {
    res.json({ message: 'Sample endpoint working!' });
  } catch (err) {
    next(err);
  }
};ontrollers/sampleController.js
exports.getSample = (req, res, next) => {
  try {
    res.json({ message: "Sample endpoint working!" });
  } catch (err) {
    next(err);
  }
};
