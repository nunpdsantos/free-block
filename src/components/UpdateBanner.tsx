import './UpdateBanner.css';

type UpdateBannerProps = {
  onUpdate: () => void;
};

export function UpdateBanner({ onUpdate }: UpdateBannerProps) {
  return (
    <div className="update-banner">
      <span className="update-banner__text">New version available</span>
      <button className="update-banner__btn" onClick={onUpdate}>
        Refresh
      </button>
    </div>
  );
}
