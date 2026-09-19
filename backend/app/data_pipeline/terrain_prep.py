import numpy as np

class TerrainDataProcessor:
    """
    Prepares terrain and elevation data (e.g., SRTM) for feature engineering.
    """
    
    @staticmethod
    def calculate_slope(elevation_grid: np.ndarray, cell_size: float = 30.0) -> np.ndarray:
        """
        Calculates slope (in degrees) from an elevation grid.
        Uses a basic 3x3 window gradient method.
        """
        # Pad grid to handle edges
        padded = np.pad(elevation_grid, pad_width=1, mode='edge')
        
        # Calculate gradients (using central difference)
        dz_dx = (padded[1:-1, 2:] - padded[1:-1, :-2]) / (2 * cell_size)
        dz_dy = (padded[2:, 1:-1] - padded[:-2, 1:-1]) / (2 * cell_size)
        
        # Calculate slope magnitude
        slope_rad = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2))
        slope_deg = np.degrees(slope_rad)
        
        return slope_deg
        
    @staticmethod
    def handle_nodata(elevation_grid: np.ndarray, nodata_value: float = -32768) -> np.ndarray:
        """Masks typical SRTM NoData values."""
        grid = elevation_grid.astype(float)
        grid[grid == nodata_value] = np.nan
        return grid

if __name__ == "__main__":
    # Test slope calculation
    elev = np.array([
        [100, 100, 100],
        [100, 110, 100],
        [100, 100, 100]
    ])
    print("Slope calculation test:\n", TerrainDataProcessor.calculate_slope(elev))
